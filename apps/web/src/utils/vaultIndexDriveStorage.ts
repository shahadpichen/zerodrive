import logger from "./logger";
import { googleDriveFetch } from "./googleDriveRequest";

export const HIDDEN_VAULT_INDEX_FILE_NAME = "zerodrive-vault-index.zd";
export const LEGACY_VAULT_INDEX_FILE_NAME = "db-list.json";
export const VAULT_INDEX_MIGRATION_NOTICE_EVENT =
  "zerodrive-vault-index-migrated-to-appdata";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const MIGRATION_NOTICE_KEY = "zerodrive:vault-index-appdata-migration-notice";
const MIGRATION_NOTICE_SESSION_KEY =
  "zerodrive:vault-index-appdata-migration-notice-shown";

export type VaultIndexStorageLocation =
  "hidden_app_data" | "legacy_visible_drive";

export interface VaultIndexDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  location: VaultIndexStorageLocation;
}

export interface VaultIndexReadTarget {
  file: VaultIndexDriveFile | null;
  shouldMigrateLegacy: boolean;
}

interface DriveListResponse {
  files?: Array<{
    id?: string;
    name?: string;
    modifiedTime?: string;
  }>;
}

interface MigrationNoticeState {
  version: 1;
  remainingViews: number;
  migratedAt: number;
}

type DriveRequestError = Error & { status?: number };

function createDriveRequestError(
  response: Response,
  action: string,
): DriveRequestError {
  const error = new Error(
    `${action}: ${response.status} ${response.statusText}`,
  ) as DriveRequestError;
  error.status = response.status;
  return error;
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeDriveFiles(
  files: DriveListResponse["files"],
  location: VaultIndexStorageLocation,
): VaultIndexDriveFile[] {
  return (files ?? [])
    .filter((file) => typeof file.id === "string" && file.id.length > 0)
    .map((file) => ({
      id: file.id!,
      name: file.name ?? "",
      modifiedTime: file.modifiedTime,
      location,
    }));
}

function assertSingleHiddenVaultIndexFile(files: VaultIndexDriveFile[]): void {
  if (files.length <= 1) return;

  throw new Error(
    "Multiple hidden vault indexes were found. ZeroDrive cannot safely choose which encrypted file list is current.",
  );
}

async function listVaultIndexFiles(
  token: string,
  location: VaultIndexStorageLocation,
): Promise<VaultIndexDriveFile[]> {
  const fileName =
    location === "hidden_app_data"
      ? HIDDEN_VAULT_INDEX_FILE_NAME
      : LEGACY_VAULT_INDEX_FILE_NAME;

  const params = new URLSearchParams({
    q: `name='${escapeDriveQueryLiteral(fileName)}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: "10",
    spaces: location === "hidden_app_data" ? "appDataFolder" : "drive",
  });

  const response = await googleDriveFetch(
    `${DRIVE_FILES_URL}?${params.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw createDriveRequestError(
      response,
      `Failed to search ${fileName} in Google Drive`,
    );
  }

  const result = (await response.json()) as DriveListResponse;
  const files = normalizeDriveFiles(result.files, location);
  if (files.length > 1) {
    const action =
      location === "hidden_app_data"
        ? "refusing to choose automatically"
        : "using the most recently modified one";
    logger.warn(
      `[VaultIndex] Found ${files.length} ${fileName} files; ${action}.`,
    );
  }

  return files;
}

export async function findVaultIndexReadTarget(
  token: string,
): Promise<VaultIndexReadTarget> {
  const hiddenFiles = await listVaultIndexFiles(token, "hidden_app_data");
  assertSingleHiddenVaultIndexFile(hiddenFiles);
  if (hiddenFiles.length > 0) {
    return {
      file: hiddenFiles[0],
      shouldMigrateLegacy: false,
    };
  }

  const legacyFiles = await listVaultIndexFiles(token, "legacy_visible_drive");
  if (legacyFiles.length > 0) {
    return {
      file: legacyFiles[0],
      shouldMigrateLegacy: true,
    };
  }

  return {
    file: null,
    shouldMigrateLegacy: false,
  };
}

export async function downloadVaultIndexBlob(
  token: string,
  file: VaultIndexDriveFile,
): Promise<Blob> {
  const response = await googleDriveFetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}?alt=media`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw createDriveRequestError(
      response,
      "Failed to download vault index from Google Drive",
    );
  }

  return response.blob();
}

async function deleteVaultIndexFile(
  token: string,
  fileId: string,
): Promise<void> {
  const response = await googleDriveFetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw createDriveRequestError(
      response,
      "Failed to remove conflicting hidden vault index from Google Drive",
    );
  }
}

async function uploadHiddenVaultIndexBlob(
  token: string,
  encryptedBlob: Blob,
  existingFile: VaultIndexDriveFile | null,
): Promise<string> {
  const metadata =
    existingFile !== null
      ? {}
      : {
          name: HIDDEN_VAULT_INDEX_FILE_NAME,
          mimeType: "application/octet-stream",
          parents: ["appDataFolder"],
        };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", encryptedBlob);

  const uploadUrl =
    existingFile !== null
      ? `${DRIVE_UPLOAD_URL}/${encodeURIComponent(
          existingFile.id,
        )}?uploadType=multipart&fields=id`
      : `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`;
  const method = existingFile !== null ? "PATCH" : "POST";

  const response = await googleDriveFetch(uploadUrl, {
    method,
    body: form,
  });

  const responseText = await response.text();
  if (!response.ok) {
    const error = createDriveRequestError(
      response,
      "Failed to write hidden vault index to Google Drive",
    );
    if (responseText) error.message = `${error.message} - ${responseText}`;
    throw error;
  }

  if (existingFile) return existingFile.id;

  try {
    const parsed = JSON.parse(responseText) as { id?: string };
    if (typeof parsed.id === "string" && parsed.id.length > 0) {
      return parsed.id;
    }
  } catch {
    // Fall through to searching by name.
  }

  const createdFiles = await listVaultIndexFiles(token, "hidden_app_data");
  assertSingleHiddenVaultIndexFile(createdFiles);
  const [createdFile] = createdFiles;
  if (!createdFile) {
    throw new Error("Hidden vault index was written but could not be found.");
  }
  return createdFile.id;
}

async function deleteCreatedIndexAndAssertSingleConflict(
  token: string,
  createdFileId: string,
  conflictingFiles: VaultIndexDriveFile[],
): Promise<VaultIndexDriveFile> {
  try {
    await deleteVaultIndexFile(token, createdFileId);
  } catch (error) {
    logger.error(
      "[VaultIndex] Failed to clean up conflicting hidden vault index.",
      error,
    );
    throw error;
  }

  assertSingleHiddenVaultIndexFile(conflictingFiles);
  return conflictingFiles[0];
}

export async function writeVaultIndexBlob(
  token: string,
  encryptedBlob: Blob,
  options: { beforeUpload?: () => void } = {},
): Promise<string> {
  const hiddenFiles = await listVaultIndexFiles(token, "hidden_app_data");
  assertSingleHiddenVaultIndexFile(hiddenFiles);
  const [existingFile] = hiddenFiles;
  options.beforeUpload?.();
  if (existingFile) {
    return uploadHiddenVaultIndexBlob(token, encryptedBlob, existingFile);
  }

  const id = await uploadHiddenVaultIndexBlob(token, encryptedBlob, null);
  const hiddenFilesAfterCreate = await listVaultIndexFiles(
    token,
    "hidden_app_data",
  );
  const conflictingFiles = hiddenFilesAfterCreate.filter(
    (file) => file.id !== id,
  );
  if (conflictingFiles.length > 0) {
    await deleteCreatedIndexAndAssertSingleConflict(
      token,
      id,
      conflictingFiles,
    );
    throw new Error(
      "Another browser tab created the hidden vault index at the same time. Refresh Storage and try again.",
    );
  }

  return id;
}

export async function writeHiddenVaultIndexBlob(
  token: string,
  encryptedBlob: Blob,
  options: { beforeUpload?: () => void } = {},
): Promise<VaultIndexDriveFile> {
  const id = await writeVaultIndexBlob(token, encryptedBlob, options);
  return {
    id,
    name: HIDDEN_VAULT_INDEX_FILE_NAME,
    location: "hidden_app_data",
  };
}

export async function createHiddenVaultIndexBlobIfAbsent(
  token: string,
  encryptedBlob: Blob,
  options: { beforeUpload?: () => void } = {},
): Promise<{ file: VaultIndexDriveFile; created: boolean }> {
  const existingFiles = await listVaultIndexFiles(token, "hidden_app_data");
  assertSingleHiddenVaultIndexFile(existingFiles);
  const [existingFile] = existingFiles;
  if (existingFile) {
    return {
      file: existingFile,
      created: false,
    };
  }

  options.beforeUpload?.();
  const id = await uploadHiddenVaultIndexBlob(token, encryptedBlob, null);
  const hiddenFilesAfterCreate = await listVaultIndexFiles(
    token,
    "hidden_app_data",
  );
  const conflictingFiles = hiddenFilesAfterCreate.filter(
    (file) => file.id !== id,
  );

  if (conflictingFiles.length > 0) {
    const survivingFile = await deleteCreatedIndexAndAssertSingleConflict(
      token,
      id,
      conflictingFiles,
    );
    return {
      file: survivingFile,
      created: false,
    };
  }

  return {
    file: {
      id,
      name: HIDDEN_VAULT_INDEX_FILE_NAME,
      location: "hidden_app_data",
    },
    created: true,
  };
}

export function recordVaultIndexMigrationNotice(): void {
  const notice: MigrationNoticeState = {
    version: 1,
    remainingViews: 2,
    migratedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(MIGRATION_NOTICE_KEY, JSON.stringify(notice));
    window.sessionStorage.removeItem(MIGRATION_NOTICE_SESSION_KEY);
    window.dispatchEvent(new Event(VAULT_INDEX_MIGRATION_NOTICE_EVENT));
  } catch {
    // Best-effort UX notice only.
  }
}

export function consumeVaultIndexMigrationNotice(): boolean {
  try {
    if (
      window.sessionStorage.getItem(MIGRATION_NOTICE_SESSION_KEY) === "true"
    ) {
      return false;
    }

    const raw = window.localStorage.getItem(MIGRATION_NOTICE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as Partial<MigrationNoticeState>;
    if (parsed.version !== 1 || !parsed.remainingViews) {
      window.localStorage.removeItem(MIGRATION_NOTICE_KEY);
      return false;
    }

    const remainingViews = Math.max(0, parsed.remainingViews - 1);
    if (remainingViews === 0) {
      window.localStorage.removeItem(MIGRATION_NOTICE_KEY);
    } else {
      window.localStorage.setItem(
        MIGRATION_NOTICE_KEY,
        JSON.stringify({
          ...parsed,
          remainingViews,
        }),
      );
    }

    window.sessionStorage.setItem(MIGRATION_NOTICE_SESSION_KEY, "true");
    return true;
  } catch {
    return false;
  }
}
