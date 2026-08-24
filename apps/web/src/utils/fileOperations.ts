import { toast } from "sonner";
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
): Promise<boolean> => {
  const deleteToastId = toast.loading(`Deleting ${fileName}...`);

  try {
    const recoveryPhraseSession = captureActiveRecoveryPhraseSession();
    assertCanWriteVaultMetadata(userEmail);

    // 1. Attempt to delete from Google Drive
    toast.loading(`Deleting ${fileName} from Google Drive...`, {
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
      toast.warning(
        `Could not delete ${fileName} from Google Drive (may already be deleted). Proceeding locally.`,
        { id: deleteToastId },
      );
    } else {
      toast.info(
        `Removed ${fileName} from Google Drive. Updating local data...`,
        { id: deleteToastId },
      );
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

    toast.success(`Successfully processed deletion for ${fileName}.`, {
      id: deleteToastId,
    });
    return true;
  } catch (error: any) {
    logger.error(`[Delete Error - ${fileName}]:`, error);
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
  userEmail: string,
): Promise<boolean> => {
  const deleteToastId = toast.loading(`Fetching file list to delete...`);

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

      toast.loading(`Deleting ${fileIds.length} files from Google Drive...`, {
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
        toast.warning(
          `Failed to delete ${driveDeleteFailures} file(s) from Google Drive (may already be deleted). Cleaning up locally.`,
          { id: deleteToastId },
        );
      } else {
        toast.info("Removed files from Google Drive. Cleaning up locally...", {
          id: deleteToastId,
        });
      }

      await clearUserFilesFromDB(userEmail);
      const updatedFolders = await getFoldersForUser(userEmail);
      await sendToGoogleDrive([], updatedFolders, {
        userEmail,
        recoveryPhraseSession,
      });

      toast.success(
        `Successfully deleted all ${fileIds.length} files and synced metadata.`,
        { id: deleteToastId },
      );
      return true;
    });
  } catch (error: any) {
    logger.error("[Delete All Error]:", error);
    toast.error("Failed to delete all files", {
      description: error.message,
      id: deleteToastId,
    });
    return false;
  }
};
