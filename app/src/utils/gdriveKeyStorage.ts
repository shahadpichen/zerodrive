import { gapi } from "gapi-script";
import { toast } from "sonner";
import logger from "./logger";
import { getGoogleAccessToken } from "./gapiInit";

// const FOLDER_NAME = "ZeroDrive_Key_Backup"; // No longer using a visible custom folder
const RSA_KEY_FILE_NAME = "zerodrive_rsa_key_backup.json"; // Stored in appDataFolder

/**
 * Ensures the Google Drive API (v3) client is loaded.
 */
async function ensureDriveApiLoaded() {
  // Cast to any to bypass TypeScript check if drive client is not initially defined
  if (!(gapi.client as any).drive) {
    logger.log("Loading Google Drive API client...");
    await gapi.client.load("drive", "v3");
    logger.log("Google Drive API client loaded.");
  }
}

/**
 * Uploads the encrypted RSA private key to the user's Google Drive root folder.
 * If a file with the same name exists, it will be updated.
 * @param keyBlob The encrypted RSA private key as a Blob.
 * @returns A Promise that resolves to the file ID if successful.
 * @throws Error if upload fails
 */
export async function uploadEncryptedRsaKeyToDrive(
  keyBlob: Blob
): Promise<string> {
  const fileName = RSA_KEY_FILE_NAME;
  try {
    await ensureDriveApiLoaded();
    const token = await getGoogleAccessToken();
    if (!token) {
      throw new Error("User not authenticated for Google Drive upload.");
    }

    // Check if the file already exists in appDataFolder (hidden from user)
    const query = `name='${fileName}' and trashed=false`;
    const listResponse = await (gapi.client as any).drive.files.list({
      q: query,
      fields: "files(id)",
      spaces: "appDataFolder", // Store in hidden appDataFolder for security
      access_token: token,
    });

    let fileIdToUpdate: string | null = null;
    if (listResponse.result.files && listResponse.result.files.length > 0) {
      fileIdToUpdate = listResponse.result.files[0].id!;
      logger.log(
        `Found existing RSA key backup file '${fileName}' in appDataFolder. Will update it.`
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
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", keyBlob);

    const uploadUrl = fileIdToUpdate
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    const method = fileIdToUpdate ? "PATCH" : "POST";

    const response = await fetch(uploadUrl, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error(
        "Google Drive appDataFolder upload failed:",
        result.error?.message || response.statusText
      );
      throw new Error(
        `Google Drive appDataFolder upload failed: ${
          result.error?.message || response.statusText
        }`
      );
    }

    logger.log(
      `RSA key backup '${fileName}' uploaded/updated to Google Drive appDataFolder successfully. File ID: ${result.id}`
    );
    return result.id;
  } catch (error:any) {
    logger.error(
      `Error uploading RSA key backup '${fileName}' to Google Drive appDataFolder:`,
      error
    );
    // Re-throw error so caller can handle it with proper context
    throw error;
  }
}

/**
 * Downloads the encrypted RSA private key from the user's Google Drive appDataFolder (hidden).
 * @returns A Promise that resolves to a Blob containing the key data.
 * @throws Error if download fails or file not found
 */
export async function downloadEncryptedRsaKeyFromDrive(): Promise<Blob> {
  const fileName = RSA_KEY_FILE_NAME;
  try {
    await ensureDriveApiLoaded();
    const token = await getGoogleAccessToken();
    if (!token) {
      throw new Error("User not authenticated for Google Drive download.");
    }

    // Find the file by name within appDataFolder (hidden from user)
    const query = `name='${fileName}' and trashed=false`;
    const listResponse = await (gapi.client as any).drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "appDataFolder", // Search in hidden appDataFolder for security
      access_token: token,
    });

    if (!listResponse.result.files || listResponse.result.files.length === 0) {
      const errorMsg = `RSA key backup file '${fileName}' not found in Google Drive appDataFolder.`;
      logger.warn(errorMsg);
      throw new Error(errorMsg);
    }

    const fileId = listResponse.result.files[0].id!;
    logger.log(
      `Found RSA key backup file '${fileName}' in appDataFolder with ID: ${fileId}. Downloading...`
    );

    const fetchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: "GET",
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      }
    );

    if (!fetchResponse.ok) {
      throw new Error(
        `Failed to download key file from Google Drive appDataFolder: ${fetchResponse.statusText}`
      );
    }
    return await fetchResponse.blob();
  } catch (error: any) {
    logger.error(
      `Error downloading RSA key backup '${fileName}' from Google Drive appDataFolder:`,
      error
    );
    // Re-throw error so caller can handle it with proper context
    throw error;
  }
}
