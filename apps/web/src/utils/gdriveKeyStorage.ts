import logger from "./logger";
import {
  GoogleDriveRequestError,
  googleDriveFetch,
  readGoogleDriveError,
} from "./googleDriveRequest";

// const FOLDER_NAME = "ZeroDrive_Key_Backup"; // No longer using a visible custom folder
const RSA_KEY_FILE_NAME = "zerodrive_rsa_key_backup.json"; // Stored in appDataFolder

interface DriveFileReference {
  id: string;
  name?: string;
}

async function listDriveFiles(
  query: string,
  spaces: "appDataFolder" | "drive",
): Promise<DriveFileReference[]> {
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    spaces,
  });
  const response = await googleDriveFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw await readGoogleDriveError(
      response,
      "Google Drive key backup lookup failed",
    );
  }

  const result = (await response.json()) as { files?: DriveFileReference[] };
  return result.files ?? [];
}

function isGoogleDriveAuthError(error: unknown): boolean {
  return (
    error instanceof GoogleDriveRequestError &&
    (error.status === 401 || error.status === 403)
  );
}

/**
 * Uploads the encrypted RSA private key to the user's Google Drive root folder.
 * If a file with the same name exists, it will be updated.
 * @param keyBlob The encrypted RSA private key as a Blob.
 * @returns A Promise that resolves to the file ID if successful.
 * @throws Error if upload fails
 */
export async function uploadEncryptedRsaKeyToDrive(
  keyBlob: Blob,
  keyVersion?: number,
): Promise<string> {
  const fileName = keyVersion
    ? `zerodrive_rsa_key_backup_v${keyVersion}.json`
    : RSA_KEY_FILE_NAME;
  try {
    // Check if the file already exists in appDataFolder (hidden from user)
    const query = `name='${fileName}' and trashed=false`;
    const existingFiles = await listDriveFiles(query, "appDataFolder");

    let fileIdToUpdate: string | null = null;
    if (existingFiles.length > 0) {
      fileIdToUpdate = existingFiles[0].id;
      logger.log(
        `Found existing RSA key backup file '${fileName}' in appDataFolder. Will update it.`,
      );
    }

    const metadata: any = {
      name: fileName,
      mimeType: "application/json",
    };
    if (!fileIdToUpdate) {
      // New files must explicitly set appDataFolder as parent
      metadata.parents = ["appDataFolder"];
    }

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("file", keyBlob);

    const uploadUrl = fileIdToUpdate
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    const method = fileIdToUpdate ? "PATCH" : "POST";

    const response = await googleDriveFetch(uploadUrl, {
      method: method,
      body: form,
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error(
        "Google Drive appDataFolder upload failed:",
        result.error?.message || response.statusText,
      );
      throw new Error(
        `Google Drive appDataFolder upload failed: ${
          result.error?.message || response.statusText
        }`,
      );
    }

    logger.log(
      `RSA key backup '${fileName}' uploaded/updated to Google Drive appDataFolder successfully. File ID: ${result.id}`,
    );
    return result.id;
  } catch (error: any) {
    logger.error(
      `Error uploading RSA key backup '${fileName}' to Google Drive appDataFolder:`,
      error,
    );
    // Re-throw error so caller can handle it with proper context
    throw error;
  }
}

/**
 * Downloads the encrypted RSA private key from the user's Google Drive.
 * Searches in multiple locations for backward compatibility:
 * 1. appDataFolder (hidden, preferred)
 * 2. Root of Google Drive (My Drive)
 * @returns A Promise that resolves to a Blob containing the key data.
 * @throws Error if download fails or file not found in any location
 */
export async function downloadEncryptedRsaKeyFromDrive(
  keyVersion?: number,
): Promise<Blob> {
  const fileName = keyVersion
    ? `zerodrive_rsa_key_backup_v${keyVersion}.json`
    : RSA_KEY_FILE_NAME;

  let fileId: string | null = null;
  let foundLocation: string = "";

  // FIRST: Try appDataFolder (hidden, preferred location)
  try {
    logger.log(`Searching for RSA key backup in appDataFolder...`);
    const query = `name='${fileName}' and trashed=false`;
    const files = await listDriveFiles(query, "appDataFolder");

    if (files.length > 0) {
      fileId = files[0].id;
      foundLocation = "appDataFolder (hidden)";
      logger.log(`Found RSA key backup in appDataFolder with ID: ${fileId}`);
    }
  } catch (appDataError) {
    if (isGoogleDriveAuthError(appDataError)) {
      throw appDataError;
    }
    logger.warn(`Could not search appDataFolder:`, appDataError);
  }

  // SECOND: If not found, try root of Google Drive
  if (!fileId && !keyVersion) {
    try {
      logger.log(`Searching for RSA key backup in root Google Drive...`);
      const query = `name='${fileName}' and 'root' in parents and trashed=false`;
      const files = await listDriveFiles(query, "drive");

      if (files.length > 0) {
        fileId = files[0].id;
        foundLocation = "root Google Drive";
        logger.log(`Found RSA key backup in root Drive with ID: ${fileId}`);
      }
    } catch (rootError) {
      if (isGoogleDriveAuthError(rootError)) {
        throw rootError;
      }
      logger.warn(`Could not search root Google Drive:`, rootError);
    }
  }

  // If still not found, throw error
  if (!fileId) {
    const errorMsg = `RSA key backup file '${fileName}' not found in appDataFolder or root Google Drive.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Download the file
  try {
    logger.log(`Downloading RSA key backup from ${foundLocation}...`);
    const fetchResponse = await googleDriveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: "GET",
      },
    );

    if (!fetchResponse.ok) {
      throw new Error(
        `Failed to download key file from ${foundLocation}: ${fetchResponse.statusText}`,
      );
    }

    logger.log(`Successfully downloaded RSA key backup from ${foundLocation}`);
    return await fetchResponse.blob();
  } catch (downloadError: any) {
    logger.error(
      `Error downloading RSA key backup from ${foundLocation}:`,
      downloadError,
    );
    throw downloadError;
  }
}
