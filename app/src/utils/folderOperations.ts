import { toast } from "sonner";
import {
  addFolder,
  getFoldersForUser,
  getFilesInFolder,
  deleteFolder as deleteFolderFromDB,
  moveFileToFolder,
  getAllFilesForUser,
  sendToGoogleDrive,
  getFileByIdForUser,
} from "./dexieDB";
import type { FolderMeta } from "./dexieDB";
import logger from "./logger";

export const createFolder = async (
  folderName: string,
  parentId: string | null,
  userEmail: string
): Promise<FolderMeta | null> => {
  const createToastId = toast.loading(`Creating folder "${folderName}"...`);

  try {
    const { getGoogleAccessToken } = await import("./gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) throw new Error("User not authenticated.");

    // Create folder on Google Drive
    const metadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    };

    logger.log("[Folder] Creating folder on Google Drive:", metadata);
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=id,name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.id) {
      throw new Error(`Failed to create folder: ${data.error?.message || "Unknown error"}`);
    }

    logger.log("[Folder] Folder created on Google Drive:", data);

    // Add to IndexedDB
    const newFolder: FolderMeta = {
      id: data.id,
      name: folderName,
      parentId: parentId || null,
      userEmail,
      createdDate: new Date(),
    };
    await addFolder(newFolder);

    // Sync metadata
    const updatedFiles = await getAllFilesForUser(userEmail);
    const updatedFolders = await getFoldersForUser(userEmail);
    await sendToGoogleDrive(updatedFiles, updatedFolders);

    toast.success(`Folder "${folderName}" created`, { id: createToastId });
    return newFolder;
  } catch (error: any) {
    logger.error("[Folder] Failed to create folder:", error);
    toast.error("Failed to create folder", {
      description: error.message,
      id: createToastId,
    });
    return null;
  }
};

export const deleteFolder = async (
  folderId: string,
  folderName: string,
  userEmail: string,
  force: boolean = false
): Promise<boolean> => {
  const deleteToastId = toast.loading(`Deleting folder "${folderName}"...`);

  try {
    // Check if folder has files
    const filesInFolder = await getFilesInFolder(userEmail, folderId);

    if (filesInFolder.length > 0 && !force) {
      toast.error("Folder is not empty", {
        description: `Move or delete ${filesInFolder.length} file(s) first`,
        id: deleteToastId,
      });
      return false;
    }

    // If force, move files to root
    if (force && filesInFolder.length > 0) {
      logger.log(`[Folder] Moving ${filesInFolder.length} files to root before deleting folder`);
      await Promise.all(filesInFolder.map((f) => moveFileToFolder(f.id, null)));
    }

    const { getGoogleAccessToken } = await import("./gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) throw new Error("User not authenticated.");

    // Delete from Google Drive
    logger.log("[Folder] Deleting folder from Google Drive:", folderId);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete folder: ${response.status} ${response.statusText}`);
    }

    // Delete from IndexedDB
    await deleteFolderFromDB(folderId);

    // Sync metadata
    const updatedFiles = await getAllFilesForUser(userEmail);
    const updatedFolders = await getFoldersForUser(userEmail);
    await sendToGoogleDrive(updatedFiles, updatedFolders);

    toast.success(`Folder "${folderName}" deleted`, { id: deleteToastId });
    return true;
  } catch (error: any) {
    logger.error("[Folder] Failed to delete folder:", error);
    toast.error("Failed to delete folder", {
      description: error.message,
      id: deleteToastId,
    });
    return false;
  }
};

export const moveFile = async (
  fileId: string,
  fileName: string,
  newFolderId: string | null,
  userEmail: string
): Promise<boolean> => {
  const moveToastId = toast.loading(`Moving "${fileName}"...`);

  try {
    const { getGoogleAccessToken } = await import("./gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) throw new Error("User not authenticated.");

    // Get current file to find old parent
    const file = await getFileByIdForUser(fileId, userEmail);
    if (!file) {
      throw new Error("File not found");
    }

    logger.log("[Folder] Moving file:", { fileId, from: file.folderId, to: newFolderId });

    // Build Google Drive API request
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?`;
    const params: string[] = [];

    if (file.folderId) {
      params.push(`removeParents=${file.folderId}`);
    }

    if (newFolderId) {
      params.push(`addParents=${newFolderId}`);
    }

    if (params.length > 0) {
      url += params.join("&");

      const response = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to move file: ${response.status} ${response.statusText}`);
      }
    }

    // Update IndexedDB
    await moveFileToFolder(fileId, newFolderId);

    // Sync metadata
    const updatedFiles = await getAllFilesForUser(userEmail);
    const updatedFolders = await getFoldersForUser(userEmail);
    await sendToGoogleDrive(updatedFiles, updatedFolders);

    toast.success(`Moved "${fileName}"`, { id: moveToastId });
    return true;
  } catch (error: any) {
    logger.error("[Folder] Failed to move file:", error);
    toast.error("Failed to move file", {
      description: error.message,
      id: moveToastId,
    });
    return false;
  }
};
