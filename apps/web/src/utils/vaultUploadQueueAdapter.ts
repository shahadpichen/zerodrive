import {
  UploadQueueError,
  type UploadQueueAdapter,
  type UploadQueueTask,
} from "@zerodrivehq/upload-queue";
import {
  type FileMeta,
  addFile,
  deleteFileFromDB,
  getAllFilesForUser,
  getFileByIdForUser,
  getFoldersForUser,
  sendToGoogleDrive,
} from "./dexieDB";
import { encryptFile } from "./encryptFile";
import {
  assertRecoveryPhraseGeneration,
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
  RecoveryPhraseChangedError,
} from "./mnemonicManager";
import { trackFileAddedToDrive } from "./analyticsTracker";
import { assertCanWriteVaultMetadata } from "./vaultMetadataWriteGuard";
import {
  GoogleDriveRequestError,
  googleDriveFetch,
  readGoogleDriveError,
} from "./googleDriveRequest";
import { getSessionUser } from "./sessionManager";
import { withVaultMetadataCommitLock } from "./vaultMetadataCommitCoordinator";

export interface VaultUploadSource {
  sourceId: string;
}

export interface VaultUploadMetadata {
  userEmail: string;
  folderId: string | null;
  allowMetadataReplacement: boolean;
}

export interface PreparedVaultUpload {
  encryptedBlob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  objectId: string;
  recoveryPhraseGeneration: number;
  driveFileId?: string;
}

export interface UploadedVaultUpload extends PreparedVaultUpload {
  driveFileId: string;
}

export type VaultUploadTask = UploadQueueTask<
  VaultUploadSource,
  VaultUploadMetadata,
  FileMeta
>;

export interface VaultUploadSourceStore {
  get(sourceId: string): File | undefined;
  release(sourceId: string): void;
}

const normalizedEmail = (email: string) => email.trim().toLowerCase();

function taskMetadata(task: VaultUploadTask): VaultUploadMetadata {
  if (!task.metadata) {
    throw new UploadQueueError(
      "UPLOAD_METADATA_MISSING",
      "Upload details are missing. Choose the file again.",
    );
  }
  return task.metadata;
}

function assertAccountStillCurrent(userEmail: string): void {
  const sessionUser = getSessionUser();
  if (
    !sessionUser ||
    normalizedEmail(sessionUser) !== normalizedEmail(userEmail)
  ) {
    throw new UploadQueueError(
      "UPLOAD_ACCOUNT_CHANGED",
      "The signed-in session changed. Choose the file again for this account.",
    );
  }
}

function isRetryableDriveStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function queueError(
  stage: "prepare" | "upload" | "commit",
  error: unknown,
): UploadQueueError {
  if (error instanceof UploadQueueError) return error;

  if (error instanceof RecoveryPhraseChangedError) {
    return new UploadQueueError(
      "VAULT_ACCESS_CHANGED",
      "Recovery & Access changed during this upload. Remove it and choose the file again.",
      { cause: error },
    );
  }

  if (error instanceof GoogleDriveRequestError) {
    const reconnectRequired = error.status === 401 || error.status === 403;
    return new UploadQueueError(
      reconnectRequired ? "DRIVE_ACCESS_REQUIRED" : "DRIVE_REQUEST_FAILED",
      reconnectRequired
        ? "Google Drive needs to be reconnected before this upload can continue."
        : "Google Drive could not complete this upload.",
      {
        retryable: isRetryableDriveStatus(error.status),
        cause: error,
      },
    );
  }

  const networkFailure = error instanceof TypeError && stage !== "prepare";
  const fallbackMessage =
    stage === "prepare"
      ? "The file could not be encrypted."
      : stage === "upload"
        ? "The encrypted file could not be uploaded."
        : "The encrypted file was uploaded, but Storage could not be updated.";

  return new UploadQueueError(
    networkFailure
      ? "NETWORK_INTERRUPTED"
      : `UPLOAD_${stage.toUpperCase()}_FAILED`,
    networkFailure
      ? "The connection was interrupted. ZeroDrive will retry."
      : fallbackMessage,
    { retryable: networkFailure, cause: error },
  );
}

async function deleteUploadedDriveObject(fileId: string): Promise<void> {
  const response = await googleDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw await readGoogleDriveError(
      response,
      "Could not remove the canceled encrypted upload",
    );
  }
}

async function generateDriveFileId(signal: AbortSignal): Promise<string> {
  const response = await googleDriveFetch(
    "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files",
    { signal },
  );
  if (!response.ok) {
    throw await readGoogleDriveError(
      response,
      "Google Drive could not prepare the encrypted upload",
    );
  }
  const body = (await response.json()) as { ids?: unknown };
  const id = Array.isArray(body.ids) ? body.ids[0] : undefined;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Google Drive did not return a file ID");
  }
  return id;
}

async function driveObjectExists(
  fileId: string,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await googleDriveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id`,
    { signal },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw await readGoogleDriveError(
      response,
      "Google Drive could not verify the encrypted upload",
    );
  }
  return true;
}

export function createVaultUploadQueueAdapter(
  sourceStore: VaultUploadSourceStore,
): UploadQueueAdapter<
  VaultUploadSource,
  PreparedVaultUpload,
  UploadedVaultUpload,
  FileMeta,
  VaultUploadMetadata
> {
  return {
    canRunNow: () =>
      typeof navigator === "undefined" || navigator.onLine !== false,

    async prepare(task, context) {
      try {
        const metadata = taskMetadata(task);
        assertAccountStillCurrent(metadata.userEmail);
        assertCanWriteVaultMetadata(metadata.userEmail, {
          allowMetadataReplacement: metadata.allowMetadataReplacement,
        });

        const file = sourceStore.get(task.source.sourceId);
        if (!file) {
          throw new UploadQueueError(
            "UPLOAD_SOURCE_MISSING",
            "The selected file is no longer available. Choose it again.",
          );
        }
        // Storage follows the user's Google Drive quota instead of imposing a
        // separate ZeroDrive size cap. Encryption still buffers one file per
        // active queue worker; streaming encryption and resumable Drive upload
        // remain the path to reliably handling very large files.
        context.throwIfCanceled();
        const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
        const objectId = crypto.randomUUID();
        const encryptedBlob = await encryptFile(
          file,
          objectId,
          recoveryPhraseSession.phrase,
        );
        context.throwIfCanceled();
        assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
        sourceStore.release(task.source.sourceId);
        context.reportProgress(1);

        return {
          encryptedBlob,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          objectId,
          recoveryPhraseGeneration: recoveryPhraseSession.generation,
        };
      } catch (error) {
        const mappedError = queueError("prepare", error);
        if (!mappedError.retryable) {
          sourceStore.release(task.source.sourceId);
        }
        throw mappedError;
      }
    },

    async upload(task, prepared, context) {
      try {
        const metadata = taskMetadata(task);
        assertAccountStillCurrent(metadata.userEmail);
        assertRecoveryPhraseGeneration(prepared.recoveryPhraseGeneration);
        context.throwIfCanceled();

        prepared.driveFileId ??= await generateDriveFileId(context.signal);
        context.throwIfCanceled();
        assertRecoveryPhraseGeneration(prepared.recoveryPhraseGeneration);

        const driveMetadata = {
          id: prepared.driveFileId,
          name: `${crypto.randomUUID()}.zd`,
          mimeType: "application/octet-stream",
          parents: metadata.folderId ? [metadata.folderId] : undefined,
        };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(driveMetadata)], {
            type: "application/json",
          }),
        );
        form.append("file", prepared.encryptedBlob);

        const response = await googleDriveFetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
          {
            method: "POST",
            body: form,
            signal: context.signal,
          },
        );
        if (response.status === 409) {
          const exists = await driveObjectExists(
            prepared.driveFileId,
            context.signal,
          );
          if (!exists) {
            throw await readGoogleDriveError(
              response,
              "Google Drive upload conflicted",
            );
          }
        } else if (!response.ok) {
          throw await readGoogleDriveError(
            response,
            "Google Drive upload failed",
          );
        }

        if (response.status !== 409) {
          const body = (await response.json()) as { id?: unknown };
          if (body.id !== prepared.driveFileId) {
            throw new Error("Google Drive returned an unexpected file ID");
          }
        }

        context.throwIfCanceled();
        assertRecoveryPhraseGeneration(prepared.recoveryPhraseGeneration);
        context.reportProgress(1);
        return { ...prepared, driveFileId: prepared.driveFileId };
      } catch (error) {
        throw queueError("upload", error);
      }
    },

    async commit(task, uploaded, context) {
      try {
        const metadata = taskMetadata(task);
        assertAccountStillCurrent(metadata.userEmail);
        assertRecoveryPhraseGeneration(uploaded.recoveryPhraseGeneration);
        context.throwIfCanceled();

        const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
        assertRecoveryPhraseGeneration(uploaded.recoveryPhraseGeneration);

        const fileMeta: FileMeta = {
          id: uploaded.driveFileId,
          objectId: uploaded.objectId,
          revision: 1,
          name: uploaded.fileName,
          mimeType: uploaded.mimeType,
          userEmail: metadata.userEmail,
          uploadedDate: new Date(),
          folderId: metadata.folderId,
        };

        await withVaultMetadataCommitLock(metadata.userEmail, async () => {
          const existing = await getFileByIdForUser(
            uploaded.driveFileId,
            metadata.userEmail,
          );
          if (!existing) await addFile(fileMeta);

          const [files, folders] = await Promise.all([
            getAllFilesForUser(metadata.userEmail),
            getFoldersForUser(metadata.userEmail),
          ]);
          await sendToGoogleDrive(files, folders, {
            userEmail: metadata.userEmail,
            allowMetadataReplacement: metadata.allowMetadataReplacement,
            recoveryPhraseSession,
          });
        });
        assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
        await trackFileAddedToDrive("upload", uploaded.size, uploaded.mimeType);
        context.reportProgress(1);
        return fileMeta;
      } catch (error) {
        throw queueError("commit", error);
      }
    },

    async cleanup(task, artifacts, reason) {
      try {
        const driveFileId =
          artifacts.uploaded?.driveFileId ?? artifacts.prepared?.driveFileId;
        if (reason === "canceled" && driveFileId && !artifacts.result) {
          const metadata = taskMetadata(task);
          let cleanupError: unknown;
          try {
            await deleteUploadedDriveObject(driveFileId);
          } catch (error) {
            cleanupError = error;
          }

          try {
            await withVaultMetadataCommitLock(metadata.userEmail, async () => {
              const existing = await getFileByIdForUser(
                driveFileId,
                metadata.userEmail,
              );
              if (!existing) return;

              await deleteFileFromDB(driveFileId);
              const phraseSession = captureActiveRecoveryPhraseSession();
              const [files, folders] = await Promise.all([
                getAllFilesForUser(metadata.userEmail),
                getFoldersForUser(metadata.userEmail),
              ]);
              await sendToGoogleDrive(files, folders, {
                userEmail: metadata.userEmail,
                allowMetadataReplacement: metadata.allowMetadataReplacement,
                recoveryPhraseSession: phraseSession,
              });
            });
          } catch (error) {
            cleanupError ??= error;
          }

          if (cleanupError) throw cleanupError;
        }
      } finally {
        sourceStore.release(task.source.sourceId);
      }
    },
  };
}
