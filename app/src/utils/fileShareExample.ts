/**
 * @file fileShareExample.ts
 * Example usage of the file sharing utilities.
 */

import { v4 as uuidv4 } from "uuid";
import {
  generateUserKeyPair,
  hashEmail,
  storeUserPublicKey,
  prepareFileForSharing,
  storeFileShare,
  findFilesSharedWithRecipient,
  markFileShareAsClaimed,
} from "./fileSharing";
import { uploadAndSyncFile } from "./fileOperations";
import logger from "./logger";

/**
 * Step 1: Set up a user's key pair and store the public key.
 * This is typically done once during user onboarding.
 */
export async function setupUserKeys(userEmail: string): Promise<void> {
  try {
    // Generate a new key pair for the user
    const keyPair = await generateUserKeyPair();

    // Hash the user's email to store with their public key
    const hashedEmail = await hashEmail(userEmail);

    // Store the public key in Supabase
    await storeUserPublicKey(hashedEmail, keyPair.publicKeyJwk);

    // The private key should be stored securely by the user
    // Often it would be encrypted with a password or stored in a secure enclave

    // For simplicity in this example, we could store it in localStorage
    // WARNING: In a real application, do not store private keys in localStorage
    const privateKeyString = JSON.stringify(keyPair.privateKeyJwk);
    localStorage.setItem("user_private_key", privateKeyString);

    logger.log("User keys set up successfully");
  } catch (error) {
    logger.error("Error setting up user keys:", error);
    throw error;
  }
}

/**
 * Step 2: Share a file with another user.
 * This demonstrates the complete file sharing process.
 */
export async function shareFileWithUser(
  file: File,
  recipientEmail: string,
  senderEmail: string
): Promise<string> {
  try {
    // Step 2.1: Prepare the file for sharing (encrypt file, encrypt key for recipient)
    const preparation = await prepareFileForSharing(
      file,
      recipientEmail,
      senderEmail
    );

    // Step 2.2: Upload the encrypted file to Google Drive
    // In your application, this would use your existing Google Drive upload mechanism
    const uploadResult = await uploadAndSyncFile(
      new File([preparation.encryptedFileBlob], preparation.fileName, {
        type: "application/octet-stream", // Store as binary
      }),
      senderEmail
    );

    if (!uploadResult || !uploadResult.id) {
      throw new Error("Failed to upload encrypted file to Google Drive");
    }

    // Step 2.3: Generate a unique share ID
    const shareId = uuidv4();

    // Step 2.4: Store the share information in Supabase
    await storeFileShare(shareId, uploadResult.id, preparation);

    logger.log(`File "${preparation.fileName}" shared with ${recipientEmail}`);
    return shareId;
  } catch (error) {
    logger.error("Error sharing file:", error);
    throw error;
  }
}

/**
 * Step 3: Find files that have been shared with a user.
 * The user would call this to see what files they can access.
 */
export async function findMySharedFiles(userEmail: string): Promise<any[]> {
  try {
    // Find all files shared with this user
    const sharedFiles = await findFilesSharedWithRecipient(userEmail);
    logger.log(`Found ${sharedFiles.length} files shared with ${userEmail}`);
    return sharedFiles;
  } catch (error) {
    logger.error("Error finding shared files:", error);
    throw error;
  }
}

/**
 * Step 4: Claim a shared file.
 * This would be called when a user wants to download and save a shared file.
 */
export async function claimSharedFile(shareId: string): Promise<void> {
  try {
    // Mark the file as claimed in Supabase
    await markFileShareAsClaimed(shareId);
    logger.log(`File with share ID ${shareId} marked as claimed`);
  } catch (error) {
    logger.error("Error claiming shared file:", error);
    throw error;
  }
}

/**
 * Complete example workflow showing the entire process.
 */
export async function completeFileShareWorkflow(
  file: File,
  senderEmail: string,
  recipientEmail: string
): Promise<void> {
  // For demonstration purposes only
  logger.log("Starting file sharing workflow...");

  // 1. Set up keys for both sender and recipient (normally done once per user)
  logger.log("Setting up keys for both users...");
  await setupUserKeys(senderEmail);
  await setupUserKeys(recipientEmail);

  // 2. Share the file
  logger.log(`Sharing file from ${senderEmail} to ${recipientEmail}...`);
  const shareId = await shareFileWithUser(file, recipientEmail, senderEmail);

  // 3. Recipient finds shared files
  logger.log(`${recipientEmail} checking for shared files...`);
  const sharedFiles = await findMySharedFiles(recipientEmail);

  // 4. Recipient claims the file
  if (sharedFiles.length > 0) {
    logger.log(`${recipientEmail} claiming shared file...`);
    await claimSharedFile(shareId);
    logger.log("File sharing workflow completed successfully");
  } else {
    logger.log("No shared files found to claim");
  }
}
