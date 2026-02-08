import logger from "./logger";
import { getStoredKey } from "./cryptoUtils";

export const decryptFile = async (fileBlob: Blob): Promise<Blob> => {
  try {
    // Get the decryption key using getStoredKey (handles encrypted storage)
    const key = await getStoredKey();
    if (!key) {
      throw new Error("No encryption key found in session storage");
    }

    const fileArrayBuffer = await fileBlob.arrayBuffer();

    // Check for minimum file size (IV + some encrypted data)
    if (fileArrayBuffer.byteLength < 13) {
      throw new Error("File is not properly encrypted (too small)");
    }

    const iv = new Uint8Array(12);
    iv.set(new Uint8Array(fileArrayBuffer.slice(0, 12)));
    const encryptedData = new Uint8Array(fileArrayBuffer.slice(12));

    // Attempt decryption
    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      );

      return new Blob([decryptedBuffer]);
    } catch (decryptError: unknown) {
      logger.error("Decryption operation error:", decryptError);

      // Check for specific error types
      if (decryptError instanceof Error && decryptError.name === "OperationError") {
        throw new Error(
          "Decryption failed: the encryption key doesn't match the one used to encrypt this file"
        );
      } else {
        throw new Error("Decryption failed: " + (decryptError instanceof Error ? decryptError.message : String(decryptError)));
      }
    }
  } catch (error) {
    logger.error("Decryption error:", error);
    throw error; // Re-throw to be handled by the caller
  }
};
