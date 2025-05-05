import { gapi } from "gapi-script";
import { toast } from "sonner";
import {
  FileMeta,
  addFile,
  deleteFileFromDB,
  getAllFilesForUser,
  sendToGoogleDrive, // The function that updates db-list.json
  clearUserFilesFromDB, // Function to clear DB for a user
} from "./dexieDB";
import { encryptFile } from "./encryptFile";
import { getStoredKey } from "./cryptoUtils";

// --- Upload Operation ---

/**
 * Encrypts, uploads a single file to Google Drive, adds its metadata to IndexedDB,
 * and triggers a sync of the full metadata list back to Google Drive.
 * @param file The file object to upload.
 * @param userEmail The email of the logged-in user.
 * @returns The FileMeta object if successful, null otherwise.
 */
export const uploadAndSyncFile = async (
  file: File,
  userEmail: string
): Promise<FileMeta | null> => {
  const uploadToastId = toast.loading(`Preparing ${file.name}...`);

  try {
    // 1. Check key
    const key = await getStoredKey();
    if (!key) {
      throw new Error("No encryption key found. Please manage keys.");
    }

    // 2. Check auth and get token
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    // 3. Encrypt
    toast.loading(`Encrypting ${file.name}...`, { id: uploadToastId });
    const encryptedBlob = await encryptFile(file);

    // 4. Prepare metadata & form data
    const metadata = {
      name: file.name, // Drive uses this name
      mimeType: "application/octet-stream", // Store as generic binary
      // Optional: Use original mimeType if needed elsewhere, but store generically
      // properties: { originalMimeType: file.type }
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
    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", // Only request ID
      {
        method: "POST",
        headers: new Headers({ Authorization: `Bearer ${token}` }),
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

    // 6. Add metadata to IndexedDB
    const newFileMeta: FileMeta = {
      id: data.id,
      name: file.name, // Store original name
      mimeType: file.type, // Store original mimeType
      userEmail: userEmail,
      uploadedDate: new Date(),
    };
    await addFile(newFileMeta);

    // 7. Get updated full list from IndexedDB
    const updatedList = await getAllFilesForUser(userEmail);

    // 8. Sync updated list to db-list.json on Google Drive
    await sendToGoogleDrive(updatedList); // This handles its own toasts

    toast.success(`Successfully uploaded and synced ${file.name}`, {
      id: uploadToastId,
    });
    return newFileMeta;
  } catch (error: any) {
    console.error(`[Upload Error - ${file.name}]:`, error);
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
    // 1. Check auth and get token
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    // 2. Attempt to delete from Google Drive
    toast.loading(`Deleting ${fileName} from Google Drive...`, {
      id: deleteToastId,
    });
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      }
    );

    // 2a. Check response - 404 (Not Found) is OK, means it's already gone from Drive.
    if (!response.ok && response.status !== 404) {
      console.warn(
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

    // 5. Sync updated list to db-list.json on Google Drive
    await sendToGoogleDrive(updatedList); // This handles its own success/error toast for sync

    toast.success(`Successfully processed deletion for ${fileName}.`, {
      id: deleteToastId,
    });
    return true;
  } catch (error: any) {
    console.error(`[Delete Error - ${fileName}]:`, error);
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

    // 2. Check auth and get token (needed for Drive delete loop)
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      throw new Error("User not authenticated.");
    }
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    // 3. Delete each file from Google Drive (best effort, ignore 404s)
    let driveDeleteFailures = 0;
    await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
              method: "DELETE",
              headers: new Headers({ Authorization: `Bearer ${token}` }),
            }
          );
          if (!response.ok && response.status !== 404) {
            console.warn(
              `Failed to delete file ${fileId} from Drive: ${response.statusText}`
            );
            driveDeleteFailures++;
          }
        } catch (driveError) {
          console.error(
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

    // 5. Sync the (now empty) list to db-list.json on Google Drive
    await sendToGoogleDrive([]); // Send empty array

    toast.success(
      `Successfully deleted all ${fileIds.length} files and synced metadata.`,
      { id: deleteToastId }
    );
    return true;
  } catch (error: any) {
    console.error("[Delete All Error]:", error);
    toast.error("Failed to delete all files", {
      description: error.message,
      id: deleteToastId,
    });
    return false;
  }
};
