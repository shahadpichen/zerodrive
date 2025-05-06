import Dexie from "dexie";
import { gapi } from "gapi-script";
import { toast } from "sonner";
import { initializeGapi, refreshGapiToken } from "./gapiInit";

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
  console.log(`[Dexie] Deleting file ${fileId} from local DB.`);
  return await db.table("files").where("id").equals(fileId).delete();
};

const clearUserFilesFromDB = async (userEmail: string): Promise<number> => {
  console.log(
    `[Dexie] Clearing all files for user ${userEmail} from local DB.`
  );
  return await db.table("files").where("userEmail").equals(userEmail).delete();
};

const sendToGoogleDrive = async (filesToSync: FileMeta[]) => {
  let driveUpdateToastId: string | number | undefined;
  console.log(
    "[Sync] Starting metadata sync with Google Drive for:",
    filesToSync
  );
  try {
    driveUpdateToastId = toast.loading("Syncing metadata with Google Drive...");

    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated for Google Drive update.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;
    console.log("[Sync] Authentication token obtained.");

    const fileContent = JSON.stringify({ files: filesToSync });
    console.log("[Sync] Content to sync:", fileContent);

    const metadata = {
      name: "db-list.json",
      mimeType: "application/json",
    };

    console.log("[Sync] Searching for existing db-list.json...");
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
      console.log(
        `[Sync] Found existing db-list.json with ID: ${fileIdToUpdate}`
      );
    } else {
      console.log("[Sync] No existing db-list.json found. Will create new.");
    }

    const blobContent = new Blob([fileContent], { type: "application/json" });
    const form = new FormData();

    let uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    let method = "POST";

    if (fileIdToUpdate) {
      console.log("[Sync] Preparing PATCH request to update existing file.");
      uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=multipart`;
      method = "PATCH";
      form.append(
        "metadata",
        new Blob([JSON.stringify({})], { type: "application/json" })
      );
    } else {
      console.log("[Sync] Preparing POST request to create new file.");
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
    }

    form.append("file", blobContent);

    console.log(`[Sync] Sending ${method} request to ${uploadUrl}`);
    const uploadResponse = await fetch(uploadUrl, {
      method: method,
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    console.log(`[Sync] Response Status: ${uploadResponse.status}`);
    const responseBodyText = await uploadResponse.text(); // Read body once
    console.log(`[Sync] Response Body: ${responseBodyText}`);

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
      console.warn("[Sync] Response body was not valid JSON.");
    }

    toast.success("Metadata successfully synchronized.", {
      id: driveUpdateToastId,
    });
    console.log("[Sync] Metadata sync successful. Result:", result);
  } catch (error) {
    console.error(
      "[Sync Error] Error synchronizing metadata with Google Drive:",
      error
    );
    toast.error("Failed to sync metadata with Google Drive", {
      description: error.message,
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
      const fileResponse = await gapi.client.request({
        path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        params: { alt: "media" },
      });

      // Ensure fileResponse.result is treated as JSON object
      let fileContent = fileResponse.result;
      // Sometimes GAPI might return a string that needs parsing
      if (typeof fileContent === "string") {
        try {
          fileContent = JSON.parse(fileContent);
        } catch (e) {
          console.error("Failed to parse db-list.json content", e);
          toast.error("Failed to read metadata file from Google Drive.");
          return; // Stop processing if content is invalid
        }
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
              console.warn(
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
              console.error("Error adding file to IndexedDB:", error, file);
            }
          })
        );
        console.log("Files stored successfully in IndexedDB.");
      } else {
        console.log("db-list.json file content is empty or invalid.");
        // Even if the file is empty, the local DB is cleared, which is correct.
      }
    } else {
      console.log("No db-list.json file found in Google Drive.");
      // If no file exists on Drive, clear the local DB too?
      // Or maybe leave local DB as is if offline use is desired?
      // Current behavior: local DB is not cleared if Drive file doesn't exist.
    }
  } catch (error) {
    if (error.status === 401) {
      try {
        await refreshGapiToken();
        // Retry the request after token refresh
        await fetchAndStoreFileMetadata(); // Recursive call after token refresh
      } catch (refreshError) {
        console.error("Error after token refresh:", refreshError);
        window.location.href = "/";
      }
    } else {
      console.error("Error fetching file metadata:", error);
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
