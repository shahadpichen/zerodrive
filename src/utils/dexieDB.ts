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

const getAllFilesForUser = async (userEmail: string) => {
  return await db
    .table<FileMeta>("files")
    .where("userEmail")
    .equals(userEmail)
    .toArray();
};

const getFileByIdForUser = async (id: string, userEmail: string) => {
  return await db.table<FileMeta>("files").where({ id, userEmail }).first();
};

const sendToGoogleDrive = async () => {
  const authInstance = gapi.auth2.getAuthInstance();
  const token = authInstance.currentUser.get().getAuthResponse().access_token;

  const dbListEntries = await db.table("files").toArray();

  if (dbListEntries.length > 0) {
    const filesList = dbListEntries;

    const metadata = {
      name: "db-list.json",
      mimeType: "application/json",
    };

    const fileContent = JSON.stringify({ files: filesList });

    try {
      const existingFileResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='db-list.json' and trashed=false",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const existingFiles = await existingFileResponse.json();
      let fileId;

      if (existingFiles.files.length > 0) {
        fileId = existingFiles.files[0].id;

        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append(
        "file",
        new Blob([fileContent], { type: "application/json" })
      );

      const uploadResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Error uploading to Google Drive: ${uploadResponse.statusText}`
        );
      }

      const result = await uploadResponse.json();
      toast.success("File uploaded successfully:", result);
    } catch (error) {
      toast.error("Error handling Google Drive file:", error);
    }
  }
};

const fetchAndStoreFileMetadata = async () => {
  try {
    // Initialize GAPI first
    await initializeGapi();

    const response = await gapi.client.request({
      path: "https://www.googleapis.com/drive/v3/files",
      params: {
        q: "name='db-list.json' and trashed=false",
        fields: "files(id, name, modifiedTime)",
      },
    });

    const existingFiles = response.result.files;

    if (existingFiles.length > 0) {
      const fileId = existingFiles[0].id;
      const fileResponse = await gapi.client.request({
        path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        params: { alt: "media" },
      });

      const fileContent = fileResponse.result;

      // Clear existing records before adding new ones
      await db.table("files").clear();

      if (fileContent && fileContent.files) {
        await Promise.all(
          fileContent.files.map(async (file) => {
            try {
              await addFile({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                userEmail: file.userEmail,
                uploadedDate: new Date(file.uploadedDate),
              });
            } catch (error) {
              console.error("Error adding file:", error);
            }
          })
        );
        toast.success("Files stored successfully in IndexedDB.");
      }
    } else {
      console.log("No db-list.json file found in Google Drive.");
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
};
