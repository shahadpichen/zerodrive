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
  folderId: string | null; // null = root level
}

export interface FolderMeta {
  id: string; // Google Drive folder ID
  name: string; // Folder name
  parentId: string | null; // null = root level (for nested folders)
  userEmail: string; // Owner
  createdDate: Date; // Creation timestamp
}

const db = new Dexie("ZeroDriveDB");

// Version 1: Original schema
db.version(1).stores({
  files: "id, name, mimeType, userEmail, uploadedDate",
});

// Version 2: Add folder support
db.version(2)
  .stores({
    files: "id, name, mimeType, userEmail, uploadedDate, folderId",
    folders: "id, name, parentId, userEmail, createdDate",
  })
  .upgrade((tx) => {
    // Add folderId to all existing files (set to null = root)
    return tx
      .table("files")
      .toCollection()
      .modify((file) => {
        file.folderId = null; // Existing files go to root
      });
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

// Folder CRUD operations
const addFolder = async (folder: FolderMeta): Promise<string> => {
  return await db.table<FolderMeta>("folders").add(folder);
};

const getFoldersForUser = async (userEmail: string): Promise<FolderMeta[]> => {
  return await db
    .table<FolderMeta>("folders")
    .where("userEmail")
    .equals(userEmail)
    .toArray();
};

const getFilesInFolder = async (
  userEmail: string,
  folderId: string | null
): Promise<FileMeta[]> => {
  // Get all files for user, then filter by folderId
  // This avoids issues with null values in compound indexes
  const allUserFiles = await db
    .table<FileMeta>("files")
    .where("userEmail")
    .equals(userEmail)
    .toArray();

  return allUserFiles.filter((file) => {
    // Handle both null and undefined as root folder
    const fileFolderId = file.folderId === undefined ? null : file.folderId;
    const targetFolderId = folderId === undefined ? null : folderId;
    return fileFolderId === targetFolderId;
  });
};

const deleteFolder = async (folderId: string): Promise<number> => {
  return await db.table("folders").where("id").equals(folderId).delete();
};

const moveFileToFolder = async (
  fileId: string,
  newFolderId: string | null
): Promise<void> => {
  await db
    .table("files")
    .where("id")
    .equals(fileId)
    .modify({ folderId: newFolderId });
};

const sendToGoogleDrive = async (
  filesToSync: FileMeta[],
  foldersToSync: FolderMeta[] = []
) => {
  let driveUpdateToastId: string | number | undefined;
  logger.log(
    "[Sync] Starting metadata sync with Google Drive for:",
    filesToSync,
    foldersToSync
  );
  try {
    driveUpdateToastId = toast.loading("Syncing metadata with Google Drive...");

    const { getGoogleAccessToken } = await import("./gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) {
      throw new Error("User not authenticated for Google Drive update.");
    }

    // Encrypt metadata before uploading (v2 format)
    logger.log("[Sync] Encrypting metadata...");
    const metadataContent = {
      version: 2,
      files: filesToSync,
      folders: foldersToSync,
    };
    const encryptedBlob = await encryptMetadata(metadataContent);

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

const fetchAndStoreFileMetadata = async (retryCount: number = 0): Promise<void> => {
  const MAX_RETRIES = 1; // Only retry once to prevent infinite loops

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

      // Handle both old (v1) and new (v2) formats
      let files: FileMeta[] = [];
      let folders: FolderMeta[] = [];

      if (fileContent.version === 2) {
        // New format with folders
        logger.log("[Sync] Detected v2 metadata format");
        files = fileContent.files || [];
        folders = fileContent.folders || [];
      } else {
        // Old format (v1) - backward compatibility
        logger.log("[Sync] Detected v1 metadata format, applying migration");
        if (fileContent.files && Array.isArray(fileContent.files)) {
          files = fileContent.files;
        } else if (Array.isArray(fileContent)) {
          // Very old format - array directly
          files = fileContent;
        }
        folders = [];

        // Add folderId: null to old files
        files = files.map((f) => ({
          ...f,
          folderId: f.folderId !== undefined ? f.folderId : null,
        }));
      }

      // Clear existing records before adding new ones
      await db.table("files").clear();
      await db.table("folders").clear();

      if (files && Array.isArray(files)) {
        await Promise.all(
          files.map(async (file: any) => {
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
                folderId: file.folderId !== undefined ? file.folderId : null,
              });
            } catch (error) {
              logger.error("Error adding file to IndexedDB:", error, file);
            }
          })
        );
        logger.log("Files stored successfully in IndexedDB.");
      }

      if (folders && Array.isArray(folders)) {
        await Promise.all(
          folders.map(async (folder: any) => {
            if (
              !folder ||
              !folder.id ||
              !folder.name ||
              !folder.userEmail ||
              !folder.createdDate
            ) {
              logger.warn(
                "Skipping invalid folder entry from db-list.json:",
                folder
              );
              return;
            }
            try {
              await addFolder({
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId !== undefined ? folder.parentId : null,
                userEmail: folder.userEmail,
                createdDate: new Date(folder.createdDate),
              });
            } catch (error) {
              logger.error("Error adding folder to IndexedDB:", error, folder);
            }
          })
        );
        logger.log("Folders stored successfully in IndexedDB.");
      }

      if ((!files || files.length === 0) && (!folders || folders.length === 0)) {
        logger.log("db-list.json file content is empty or invalid.");
      }
    } else {
      logger.log("No db-list.json file found in Google Drive.");
      // If no file exists on Drive, clear the local DB too?
      // Or maybe leave local DB as is if offline use is desired?
      // Current behavior: local DB is not cleared if Drive file doesn't exist.
    }
  } catch (error: any) {
    if (error?.status === 401) {
      if (retryCount >= MAX_RETRIES) {
        logger.error("Max retries reached for token refresh. Redirecting to login.");
        window.location.href = "/";
        return;
      }

      try {
        logger.warn(`Token expired (retry ${retryCount + 1}/${MAX_RETRIES}). Refreshing...`);
        await refreshGapiToken();
        // Retry the request after token refresh with incremented retry count
        await fetchAndStoreFileMetadata(retryCount + 1);
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
  // Folder operations
  addFolder,
  getFoldersForUser,
  getFilesInFolder,
  deleteFolder,
  moveFileToFolder,
};
