import { toast } from "sonner";
import {
  FileMeta,
  addFile,
  deleteFileFromDB,
  getAllFilesForUser,
  sendToGoogleDrive, // Syncs the encrypted vault index to Google Drive.
  clearUserFilesFromDB, // Function to clear DB for a user
  getFoldersForUser, // Get folders for sync
} from "./dexieDB";
import { encryptFile } from "./encryptFile";
import {
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
} from "./mnemonicManager";
import logger from "./logger";
import { trackFileAddedToDrive } from "./analyticsTracker";
import { assertCanWriteVaultMetadata } from "./vaultMetadataWriteGuard";
import {
  ensureGoogleDriveConnected,
  googleDriveFetch,
} from "./googleDriveRequest";

// --- Upload Operation ---

/**
 * Encrypts, uploads a single file to Google Drive, adds its metadata to IndexedDB,
 * and triggers a sync of the full metadata list back to Google Drive.
 * @param file The file object to upload.
 * @param userEmail The email of the logged-in user.
 * @param folderId Optional folder ID to upload to (null = root).
 * @returns The FileMeta object if successful, null otherwise.
 */
export const uploadAndSyncFile = async (
  file: File,
  userEmail: string,
  folderId?: string | null,
  options: { allowMetadataReplacement?: boolean } = {},
): Promise<FileMeta | null> => {
  const uploadToastId = toast.loading(`Preparing ${file.name}...`);

  try {
    // Capsule v1 writes require the in-memory recovery phrase. The derived
    // legacy AES key is used only when opening historical ZeroDrive objects.
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();

    assertCanWriteVaultMetadata(userEmail, {
      allowMetadataReplacement: options.allowMetadataReplacement,
    });

    // 2. Validate file size (max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      const errorMsg = `File too large. Maximum size is 100MB, your file is ${fileSizeMB}MB`;
      toast.error(errorMsg, { id: uploadToastId });
      throw new Error(errorMsg);
    }

    // 3. Encrypt
    toast.loading(`Encrypting ${file.name}...`, { id: uploadToastId });
    const objectId = crypto.randomUUID();
    const encryptedBlob = await encryptFile(
      file,
      objectId,
      recoveryPhraseSession.phrase,
    );

    // 4. Prepare metadata & form data
    const metadata = {
      name: `${crypto.randomUUID()}.zd`,
      mimeType: "application/octet-stream",
      parents: folderId ? [folderId] : undefined,
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", encryptedBlob);

    // 5. Upload to Google Drive
    toast.loading(`Uploading ${file.name} to Google Drive...`, {
      id: uploadToastId,
    });
    assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
    const response = await googleDriveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", // Only request ID
      {
        method: "POST",
        body: form,
      }
    );

    const data = await response.json();

    if (!response.ok || !data.id) {
      throw new Error(
        `Google Drive upload failed: ${
          data.error?.message || response.statusText
        }`
      );
    }

    toast.loading(`Saving metadata for ${file.name}...`, { id: uploadToastId });

    // 7. Add metadata to IndexedDB
    const newFileMeta: FileMeta = {
      id: data.id,
      objectId,
      revision: 1,
      name: file.name, // Store original name
      mimeType: file.type, // Store original mimeType
      userEmail: userEmail,
      uploadedDate: new Date(),
      folderId: folderId || null, // Store folder (null = root)
    };
    await addFile(newFileMeta);

    // 8. Get updated full list from IndexedDB
    const updatedList = await getAllFilesForUser(userEmail);
    const updatedFolders = await getFoldersForUser(userEmail);

    // 9. Sync updated encrypted vault index to Google Drive
    await sendToGoogleDrive(updatedList, updatedFolders, {
      userEmail,
      allowMetadataReplacement: options.allowMetadataReplacement,
      recoveryPhraseSession,
    }); // This handles its own toasts

    toast.success(`Successfully uploaded and synced ${file.name}`, {
      id: uploadToastId,
    });

    // Track analytics
    await trackFileAddedToDrive("upload", file.size, file.type);

    return newFileMeta;
  } catch (error: any) {
    logger.error(`[Upload Error - ${file.name}]:`, error);
    toast.error(`Failed to upload ${file.name}`, {
      description: error.message,
      id: uploadToastId,
    });
    return null;
  }
};

// --- Delete Operations ---

/**
 * Deletes a file from Google Drive, removes it from IndexedDB,
 * and syncs the updated metadata list back to Google Drive.
 * @param fileId The Google Drive file ID.
 * @param fileName The name of the file (for logging/toast).
 * @param userEmail The email of the logged-in user.
 * @returns True if successful (including DB/sync), false otherwise.
 */
export const deleteAndSyncFile = async (
  fileId: string,
  fileName: string, // Added for better feedback
  userEmail: string
): Promise<boolean> => {
  const deleteToastId = toast.loading(`Deleting ${fileName}...`);

  try {
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
    assertCanWriteVaultMetadata(userEmail);

    // 1. Attempt to delete from Google Drive
    toast.loading(`Deleting ${fileName} from Google Drive...`, {
      id: deleteToastId,
    });
    assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
    const response = await googleDriveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
      }
    );

    // 2a. Check response - 404 (Not Found) is OK, means it's already gone from Drive.
    if (!response.ok && response.status !== 404) {
      logger.warn(
        `Google Drive delete failed (Status: ${response.status}): ${response.statusText}`
      );
      // Optionally throw error or just continue to ensure local DB is cleaned up
      // throw new Error(`Google Drive delete failed: ${response.statusText}`);
      toast.warning(
        `Could not delete ${fileName} from Google Drive (may already be deleted). Proceeding locally.`,
        { id: deleteToastId }
      );
    } else {
      toast.info(
        `Removed ${fileName} from Google Drive. Updating local data...`,
        { id: deleteToastId }
      );
    }

    // 3. Delete from IndexedDB
    await deleteFileFromDB(fileId);

    // 4. Get updated full list from IndexedDB
    const updatedList = await getAllFilesForUser(userEmail);
    const updatedFolders = await getFoldersForUser(userEmail);

    // 5. Sync updated encrypted vault index to Google Drive
    await sendToGoogleDrive(updatedList, updatedFolders, {
      userEmail,
      recoveryPhraseSession,
    }); // This handles its own success/error toast for sync

    toast.success(`Successfully processed deletion for ${fileName}.`, {
      id: deleteToastId,
    });
    return true;
  } catch (error: any) {
    logger.error(`[Delete Error - ${fileName}]:`, error);
    toast.error(`Failed to process deletion for ${fileName}`, {
      description: error.message,
      id: deleteToastId,
    });
    return false;
  }
};

/**
 * Deletes ALL files for a user from Google Drive, clears their IndexedDB records,
 * and syncs an empty list back to Google Drive.
 * @param userEmail The email of the logged-in user.
 * @returns True if successful (including DB/sync), false otherwise.
 */
export const deleteAllAndSyncFiles = async (
  userEmail: string
): Promise<boolean> => {
  const deleteToastId = toast.loading(`Fetching file list to delete...`);

  try {
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
    assertCanWriteVaultMetadata(userEmail);

    // 1. Get all file IDs for the user
    const allFiles = await getAllFilesForUser(userEmail);
    if (allFiles.length === 0) {
      toast.info("No files found to delete.", { id: deleteToastId });
      return true; // Nothing to do
    }
    const fileIds = allFiles.map((file) => file.id);

    toast.loading(`Deleting ${fileIds.length} files from Google Drive...`, {
      id: deleteToastId,
    });
    await ensureGoogleDriveConnected();

    // 2. Delete each file from Google Drive (best effort, ignore 404s)
    let driveDeleteFailures = 0;
    assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
    await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const response = await googleDriveFetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
              method: "DELETE",
            }
          );
          if (!response.ok && response.status !== 404) {
            logger.warn(
              `Failed to delete file ${fileId} from Drive: ${response.statusText}`
            );
            driveDeleteFailures++;
          }
        } catch (driveError) {
          logger.error(
            `Error deleting file ${fileId} from Drive:`,
            driveError
          );
          driveDeleteFailures++;
        }
      })
    );

    if (driveDeleteFailures > 0) {
      toast.warning(
        `Failed to delete ${driveDeleteFailures} file(s) from Google Drive (may already be deleted). Cleaning up locally.`,
        { id: deleteToastId }
      );
    } else {
      toast.info(`Removed files from Google Drive. Cleaning up locally...`, {
        id: deleteToastId,
      });
    }

    // 4. Clear all files for this user from IndexedDB
    await clearUserFilesFromDB(userEmail);

    // 5. Sync the (now empty) encrypted vault index to Google Drive
    const updatedFolders = await getFoldersForUser(userEmail);
    await sendToGoogleDrive([], updatedFolders, {
      userEmail,
      recoveryPhraseSession,
    }); // Send empty file array

    toast.success(
      `Successfully deleted all ${fileIds.length} files and synced metadata.`,
      { id: deleteToastId }
    );
    return true;
  } catch (error: any) {
    logger.error("[Delete All Error]:", error);
    toast.error("Failed to delete all files", {
      description: error.message,
      id: deleteToastId,
    });
    return false;
  }
};
