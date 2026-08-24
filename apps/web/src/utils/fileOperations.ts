import { userNotifications as toast } from "./userNotifications";
import {
  deleteFileFromDB,
  getAllFilesForUser,
  sendToGoogleDrive, // Syncs the encrypted vault index to Google Drive.
  clearUserFilesFromDB, // Function to clear DB for a user
  getFoldersForUser, // Get folders for sync
} from "./dexieDB";
import {
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
} from "./mnemonicManager";
import logger from "./logger";
import { assertCanWriteVaultMetadata } from "./vaultMetadataWriteGuard";
import {
  ensureGoogleDriveConnected,
  googleDriveFetch,
} from "./googleDriveRequest";
import { withVaultMetadataCommitLock } from "./vaultMetadataCommitCoordinator";

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
  userEmail: string,
  options: { notifications?: boolean } = {},
): Promise<boolean> => {
  const notifications = options.notifications === false ? null : toast;
  const deleteToastId = `storage:delete:${fileId}`;
  notifications?.loading(`Deleting ${fileName}…`, { id: deleteToastId });

  try {
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
    assertCanWriteVaultMetadata(userEmail);

    // 1. Attempt to delete from Google Drive
    notifications?.loading(`Deleting ${fileName} from Google Drive…`, {
      id: deleteToastId,
    });
    assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
    const response = await googleDriveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
      },
    );

    // 2a. Check response - 404 (Not Found) is OK, means it's already gone from Drive.
    if (!response.ok && response.status !== 404) {
      logger.warn(
        `Google Drive delete failed (Status: ${response.status}): ${response.statusText}`,
      );
      // Optionally throw error or just continue to ensure local DB is cleaned up
      // throw new Error(`Google Drive delete failed: ${response.statusText}`);
      notifications?.warning("Google Drive could not confirm the deletion", {
        id: deleteToastId,
        description:
          "ZeroDrive will update its encrypted file list. The Drive copy may need to be removed manually.",
      });
    } else {
      notifications?.loading("Updating the encrypted file list…", {
        id: deleteToastId,
      });
    }

    await withVaultMetadataCommitLock(userEmail, async () => {
      await deleteFileFromDB(fileId);
      const updatedList = await getAllFilesForUser(userEmail);
      const updatedFolders = await getFoldersForUser(userEmail);
      await sendToGoogleDrive(updatedList, updatedFolders, {
        userEmail,
        recoveryPhraseSession,
      });
    });

    notifications?.success(`${fileName} deleted`, {
      id: deleteToastId,
    });
    return true;
  } catch (error: unknown) {
    logger.error(`[Delete Error - ${fileName}]:`, error);
    notifications?.errorFrom(
      error,
      {
        title: `${fileName} could not be deleted`,
        description: "Refresh Storage and retry the deletion.",
      },
      { id: deleteToastId },
    );
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
  userEmail: string,
): Promise<boolean> => {
  const deleteToastId = "storage:delete-all";
  toast.loading("Preparing to delete all files…", { id: deleteToastId });

  try {
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
    assertCanWriteVaultMetadata(userEmail);

    return await withVaultMetadataCommitLock(userEmail, async () => {
      const allFiles = await getAllFilesForUser(userEmail);
      if (allFiles.length === 0) {
        toast.info("No files found to delete.", { id: deleteToastId });
        return true;
      }
      const fileIds = allFiles.map((file) => file.id);

      toast.loading(`Deleting ${fileIds.length} files from Google Drive…`, {
        id: deleteToastId,
      });
      await ensureGoogleDriveConnected();

      let driveDeleteFailures = 0;
      assertRecoveryPhraseSessionCurrent(recoveryPhraseSession);
      await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            const response = await googleDriveFetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}`,
              { method: "DELETE" },
            );
            if (!response.ok && response.status !== 404) {
              logger.warn(
                `Failed to delete file ${fileId} from Drive: ${response.statusText}`,
              );
              driveDeleteFailures++;
            }
          } catch (driveError) {
            logger.error(
              `Error deleting file ${fileId} from Drive:`,
              driveError,
            );
            driveDeleteFailures++;
          }
        }),
      );

      if (driveDeleteFailures > 0) {
        toast.warning("Some Drive copies could not be removed", {
          id: deleteToastId,
          description:
            "ZeroDrive will finish updating the encrypted file list. Check Google Drive for copies that may remain.",
        });
      } else {
        toast.loading("Updating the encrypted file list…", {
          id: deleteToastId,
        });
      }

      await clearUserFilesFromDB(userEmail);
      const updatedFolders = await getFoldersForUser(userEmail);
      await sendToGoogleDrive([], updatedFolders, {
        userEmail,
        recoveryPhraseSession,
      });

      toast.success(`${fileIds.length} files deleted`, { id: deleteToastId });
      return true;
    });
  } catch (error: unknown) {
    logger.error("[Delete All Error]:", error);
    toast.errorFrom(
      error,
      {
        title: "Files could not be deleted",
        description: "Refresh Storage and retry the deletion.",
      },
      { id: deleteToastId },
    );
    return false;
  }
};
