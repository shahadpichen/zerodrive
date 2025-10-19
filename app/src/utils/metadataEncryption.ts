/**
 * Metadata Encryption Utility
 * Encrypts and decrypts file metadata (db-list.json) before storing in Google Drive
 */

import { getStoredKey } from "./cryptoUtils";
import logger from "./logger";

/**
 * Encrypts metadata JSON using the user's AES-GCM key
 * @param metadata The metadata object to encrypt
 * @returns Promise<Blob> The encrypted metadata as a Blob with prepended IV
 */
export async function encryptMetadata(metadata: any): Promise<Blob> {
  try {
    // Get the user's encryption key from sessionStorage
    const key = await getStoredKey();
    if (!key) {
      throw new Error("No encryption key found for metadata encryption");
    }

    // Convert metadata to JSON string
    const metadataString = JSON.stringify(metadata);
    const metadataBuffer = new TextEncoder().encode(metadataString);

    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the metadata
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      metadataBuffer
    );

    // Prepend IV to encrypted data
    const resultBuffer = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
    resultBuffer.set(iv, 0);
    resultBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength);

    return new Blob([resultBuffer], { type: "application/octet-stream" });
  } catch (error) {
    logger.error("Error encrypting metadata:", error);
    throw new Error("Failed to encrypt metadata");
  }
}

/**
 * Decrypts metadata from an encrypted Blob
 * @param encryptedBlob The encrypted metadata Blob with prepended IV
 * @returns Promise<any> The decrypted metadata object
 */
export async function decryptMetadata(encryptedBlob: Blob): Promise<any> {
  try {
    // Get the user's encryption key from sessionStorage
    const key = await getStoredKey();
    if (!key) {
      throw new Error("No encryption key found for metadata decryption");
    }

    // Convert blob to ArrayBuffer
    const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

    // Check minimum size (IV + some data)
    if (encryptedArrayBuffer.byteLength < 13) {
      throw new Error("Encrypted metadata is too small");
    }

    // Extract IV (first 12 bytes)
    const iv = new Uint8Array(encryptedArrayBuffer.slice(0, 12));

    // Extract encrypted data (rest)
    const encryptedData = new Uint8Array(encryptedArrayBuffer.slice(12));

    // Decrypt the metadata
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData
    );

    // Convert decrypted buffer to string and parse JSON
    const metadataString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(metadataString);
  } catch (error) {
    logger.error("Error decrypting metadata:", error);

    // Check for specific error types
    if (error.name === "OperationError") {
      throw new Error(
        "Metadata decryption failed: The encryption key doesn't match"
      );
    }

    throw new Error("Failed to decrypt metadata");
  }
}
