import Dexie from "dexie";
import { gapi } from "gapi-script";

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
        console.log("Existing file deleted successfully");
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
      console.log("File uploaded successfully:", result);
    } catch (error) {
      console.error("Error handling Google Drive file:", error);
    }
  }
};

const loadGapi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("gapi not loaded"));
      return;
    }

    window.gapi.load("client:auth2", () => {
      if (window.gapi.auth2) {
        resolve();
      } else {
        reject(new Error("gapi.auth2 not available"));
      }
    });
  });
};

const fetchAndStoreFileMetadata = async () => {
  await loadGapi();

  const authInstance = gapi.auth2.getAuthInstance();
  const token = authInstance.currentUser.get().getAuthResponse().access_token;

  try {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name='db-list.json' and trashed=false",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const existingFiles = await response.json();

    if (existingFiles.files.length > 0) {
      const fileId = existingFiles.files[0].id;
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const fileContent = await fileResponse.json();

      const filesList = fileContent.files;
      await Promise.all(
        filesList.map(async (file) => {
          await addFile({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            userEmail: file.userEmail,
            uploadedDate: new Date(file.uploadedDate),
          });
        })
      );

      console.log("Files stored successfully in IndexedDB.");
    } else {
      console.log("No db-list.json file found in Google Drive.");
    }
  } catch (error) {
    console.error("Error fetching or storing file metadata:", error);
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
