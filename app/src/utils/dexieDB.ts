import Dexie from "dexie";
import { gapi } from "gapi-script";
import { toast } from "sonner";
import { initializeGapi, refreshGapiToken } from "./gapiInit";
import logger from "./logger";
import { encryptMetadata, decryptMetadata } from "./metadataEncryption";

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  userEmail: string;
  uploadedDate: Date;
}

const db = new Dexie("ZeroDriveDB");

db.version(1).stores({
  files: "id, name, mimeType, userEmail, uploadedDate",
});

const addFile = async (file: FileMeta) => {
  return await db.table<FileMeta>("files").add(file);
};

const getAllFilesForUser = async (userEmail: string): Promise<FileMeta[]> => {
  return await db
    .table<FileMeta>("files")
    .where("userEmail")
    .equals(userEmail)
    .toArray();
};

const getFileByIdForUser = async (id: string, userEmail: string) => {
  return await db.table<FileMeta>("files").where({ id, userEmail }).first();
};

const deleteFileFromDB = async (fileId: string): Promise<number> => {
  logger.log(`[Dexie] Deleting file ${fileId} from local DB.`);
  return await db.table("files").where("id").equals(fileId).delete();
};

const clearUserFilesFromDB = async (userEmail: string): Promise<number> => {
  logger.log(
    `[Dexie] Clearing all files for user ${userEmail} from local DB.`
  );
  return await db.table("files").where("userEmail").equals(userEmail).delete();
};

const sendToGoogleDrive = async (filesToSync: FileMeta[]) => {
  let driveUpdateToastId: string | number | undefined;
  logger.log(
    "[Sync] Starting metadata sync with Google Drive for:",
    filesToSync
  );
  try {
    driveUpdateToastId = toast.loading("Syncing metadata with Google Drive...");

    const { getGoogleAccessToken } = await import("./gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) {
      throw new Error("User not authenticated for Google Drive update.");
    }

    // Encrypt metadata before uploading
    logger.log("[Sync] Encrypting metadata...");
    const encryptedBlob = await encryptMetadata({ files: filesToSync });

    const metadata = {
      name: "db-list.json",
      mimeType: "application/octet-stream", // Changed to binary since it's encrypted
    };

    logger.log("[Sync] Searching for existing db-list.json...");
    const findResponse = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name='db-list.json' and trashed=false&fields=files(id)",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!findResponse.ok) {
      throw new Error(
        `[Sync Error] Failed to search for existing metadata file: ${findResponse.status} ${findResponse.statusText}`
      );
    }

    const existingFiles = await findResponse.json();
    let fileIdToUpdate: string | null = null;

    if (existingFiles.files && existingFiles.files.length > 0) {
      fileIdToUpdate = existingFiles.files[0].id;
      logger.log(
        `[Sync] Found existing db-list.json with ID: ${fileIdToUpdate}`
      );
    } else {
      logger.log("[Sync] No existing db-list.json found. Will create new.");
    }

    // Use encrypted blob instead of plaintext
    const form = new FormData();

    let uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    let method = "POST";

    if (fileIdToUpdate) {
      logger.log("[Sync] Preparing PATCH request to update existing file.");
      uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=multipart`;
      method = "PATCH";
      form.append(
        "metadata",
        new Blob([JSON.stringify({})], { type: "application/json" })
      );
    } else {
      logger.log("[Sync] Preparing POST request to create new file.");
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
    }

    form.append("file", encryptedBlob);

    logger.log(`[Sync] Sending ${method} request to ${uploadUrl}`);
    const uploadResponse = await fetch(uploadUrl, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    logger.log(`[Sync] Response Status: ${uploadResponse.status}`);
    const responseBodyText = await uploadResponse.text(); // Read body once
    logger.log(`[Sync] Response Body: ${responseBodyText}`);

    if (!uploadResponse.ok) {
      throw new Error(
        `[Sync Error] Error ${
          method === "POST" ? "uploading" : "updating"
        } metadata file: ${uploadResponse.status} ${
          uploadResponse.statusText
        } - ${responseBodyText}`
      );
    }

    // Try parsing the response body as JSON for logging, but handle if it's not JSON
    let result = {};
    try {
      result = JSON.parse(responseBodyText);
    } catch (e) {
      logger.warn("[Sync] Response body was not valid JSON.");
    }

    toast.success("Metadata successfully synchronized.", {
      id: driveUpdateToastId,
    });
    logger.log("[Sync] Metadata sync successful. Result:", result);
  } catch (error: any) {
    logger.error(
      "[Sync Error] Error synchronizing metadata with Google Drive:",
      error
    );
    toast.error("Failed to sync metadata with Google Drive", {
      description: error?.message || "Unknown error",
      id: driveUpdateToastId,
    });
    // IMPORTANT: Re-throw the error so the calling function knows it failed
    throw error;
  }
};

const fetchAndStoreFileMetadata = async () => {
  try {
    await initializeGapi();

    const response = await gapi.client.request({
      path: "https://www.googleapis.com/drive/v3/files",
      params: {
        q: "name='db-list.json' and trashed=false",
        fields: "files(id, name, modifiedTime)",
      },
    });

    const existingFiles = response.result.files;

    if (existingFiles && existingFiles.length > 0) {
      const fileId = existingFiles[0].id;

      // Download the encrypted blob
      const { getGoogleAccessToken } = await import("./gapiInit");
      const token = await getGoogleAccessToken();
      if (!token) {
        throw new Error("Failed to get access token");
      }

      const fetchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!fetchResponse.ok) {
        throw new Error("Failed to download metadata from Google Drive");
      }

      const encryptedBlob = await fetchResponse.blob();

      // Decrypt the metadata
      logger.log("[Sync] Decrypting metadata...");
      let fileContent;
      try {
        fileContent = await decryptMetadata(encryptedBlob);
      } catch (e) {
        logger.error("Failed to decrypt db-list.json content", e);
        // Throw a specific error type so the calling code can handle it
        const decryptError = new Error("DECRYPTION_FAILED");
        decryptError.name = "DecryptionError";
        throw decryptError;
      }

      // Clear existing records before adding new ones
      await db.table("files").clear();

      if (
        fileContent &&
        fileContent.files &&
        Array.isArray(fileContent.files)
      ) {
        await Promise.all(
          fileContent.files.map(async (file: any) => {
            // Add type any temporarily or define a better interface
            // Add checks for essential properties
            if (
              !file ||
              !file.id ||
              !file.name ||
              !file.mimeType ||
              !file.userEmail ||
              !file.uploadedDate
            ) {
              logger.warn(
                "Skipping invalid file entry from db-list.json:",
                file
              );
              return;
            }
            try {
              await addFile({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                userEmail: file.userEmail,
                uploadedDate: new Date(file.uploadedDate),
              });
            } catch (error) {
              logger.error("Error adding file to IndexedDB:", error, file);
            }
          })
        );
        logger.log("Files stored successfully in IndexedDB.");
      } else {
        logger.log("db-list.json file content is empty or invalid.");
        // Even if the file is empty, the local DB is cleared, which is correct.
      }
    } else {
      logger.log("No db-list.json file found in Google Drive.");
      // If no file exists on Drive, clear the local DB too?
      // Or maybe leave local DB as is if offline use is desired?
      // Current behavior: local DB is not cleared if Drive file doesn't exist.
    }
  } catch (error: any) {
    if (error?.status === 401) {
      try {
        await refreshGapiToken();
        // Retry the request after token refresh
        await fetchAndStoreFileMetadata(); // Recursive call after token refresh
      } catch (refreshError) {
        logger.error("Error after token refresh:", refreshError);
        window.location.href = "/";
      }
    } else {
      logger.error("Error fetching file metadata:", error);
      throw error;
    }
  }
};

export {
  db,
  addFile,
  getAllFilesForUser,
  getFileByIdForUser,
  sendToGoogleDrive,
  fetchAndStoreFileMetadata,
  deleteFileFromDB,
  clearUserFilesFromDB,
};
