import { gapi } from "gapi-script";
import { toast } from "sonner";

// const FOLDER_NAME = "ZeroDrive_Key_Backup"; // No longer using a visible custom folder
const RSA_KEY_FILE_NAME = "zerodrive_rsa_key_backup.json"; // Stored in appDataFolder

/**
 * Ensures the Google Drive API (v3) client is loaded.
 */
async function ensureDriveApiLoaded() {
  // Cast to any to bypass TypeScript check if drive client is not initially defined
  if (!(gapi.client as any).drive) {
    console.log("Loading Google Drive API client...");
    await gapi.client.load("drive", "v3");
    console.log("Google Drive API client loaded.");
  }
}

/**
 * Uploads the encrypted RSA private key to the user's Google Drive root folder.
 * If a file with the same name exists, it will be updated.
 * @param keyBlob The encrypted RSA private key as a Blob.
 * @returns A Promise that resolves to the file ID if successful, or null on failure.
 */
export async function uploadEncryptedRsaKeyToDrive(
  keyBlob: Blob
): Promise<string | null> {
  const fileName = RSA_KEY_FILE_NAME;
  try {
    await ensureDriveApiLoaded();
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated for Google Drive upload.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    // Check if the file already exists in the root folder to update it
    const query = `name='${fileName}' and 'root' in parents and trashed=false`;
    const listResponse = await (gapi.client as any).drive.files.list({
      q: query,
      fields: "files(id)",
      // spaces: "appDataFolder", // No longer searching in appDataFolder
      access_token: token,
    });

    let fileIdToUpdate: string | null = null;
    if (listResponse.result.files && listResponse.result.files.length > 0) {
      fileIdToUpdate = listResponse.result.files[0].id!;
      console.log(
        `Found existing RSA key backup file '${fileName}' in Google Drive root. Will update it.`
      );
    }

    const metadata: any = {
      name: fileName,
      mimeType: "application/json",
    };
    // if (!fileIdToUpdate) { // Files created without explicit parents go to root by default
    //   metadata.parents = ["appDataFolder"];
    // }

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
      console.error(
        "Google Drive root folder upload failed:",
        result.error?.message || response.statusText
      );
      throw new Error(
        `Google Drive root folder upload failed: ${
          result.error?.message || response.statusText
        }`
      );
    }

    console.log(
      `RSA key backup '${fileName}' uploaded/updated to Google Drive root successfully. File ID: ${result.id}`
    );
    return result.id;
  } catch (error) {
    console.error(
      `Error uploading RSA key backup '${fileName}' to Google Drive root:`,
      error
    );
    toast.error(`Failed to upload RSA key backup to Google Drive.`, {
      description: error.message,
    });
    return null;
  }
}

/**
 * Downloads the encrypted RSA private key from the user's Google Drive root folder.
 * @returns A Promise that resolves to a Blob containing the key data, or null if not found or on error.
 */
export async function downloadEncryptedRsaKeyFromDrive(): Promise<Blob | null> {
  const fileName = RSA_KEY_FILE_NAME;
  try {
    await ensureDriveApiLoaded();
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated for Google Drive download.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    // Find the file by name within the root folder
    const query = `name='${fileName}' and 'root' in parents and trashed=false`;
    const listResponse = await (gapi.client as any).drive.files.list({
      q: query,
      fields: "files(id, name)",
      // spaces: "appDataFolder", // No longer searching in appDataFolder
      access_token: token,
    });

    if (!listResponse.result.files || listResponse.result.files.length === 0) {
      console.warn(
        `RSA key backup file '${fileName}' not found in Google Drive root.`
      );
      return null; // File not found
    }

    const fileId = listResponse.result.files[0].id!;
    console.log(
      `Found RSA key backup file '${fileName}' in Google Drive root with ID: ${fileId}. Downloading...`
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
        `Failed to download key file from Google Drive root: ${fetchResponse.statusText}`
      );
    }
    return await fetchResponse.blob();
  } catch (error) {
    console.error(
      `Error downloading RSA key backup '${fileName}' from Google Drive root:`,
      error
    );
    toast.error(`Failed to download RSA key backup from Google Drive.`, {
      description: error.message,
    });
    return null;
  }
}
