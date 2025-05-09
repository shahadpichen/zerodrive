import { deriveKeyFromMnemonic } from "./cryptoUtils";

/**
 * Symmetrically encrypts an RSA Private Key JWK using a provided AES-GCM CryptoKey.
 * The IV is prepended to the ciphertext.
 * @param privateKeyJwk The RSA private key in JWK format.
 * @param aesKey The AES-GCM CryptoKey to use for encryption.
 * @returns A Promise that resolves to a Blob containing the IV and the encrypted key.
 */
export async function encryptRsaPrivateKeyWithAesKey(
  privateKeyJwk: JsonWebKey,
  aesKey: CryptoKey
): Promise<Blob> {
  try {
    // 1. AES key is now provided directly.

    // 2. Convert the private key JWK to a string and then to an ArrayBuffer
    const privateKeyString = JSON.stringify(privateKeyJwk);
    const privateKeyBuffer = new TextEncoder().encode(privateKeyString);

    // 3. Generate a random Initialization Vector (IV)
    const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV size is 12 bytes

    // 4. Encrypt the private key buffer
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      privateKeyBuffer
    );

    // 5. Prepend the IV to the encrypted buffer
    const resultBuffer = new Uint8Array(
      iv.byteLength + encryptedBuffer.byteLength
    );
    resultBuffer.set(iv, 0); // Set IV at the beginning
    resultBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength); // Set ciphertext after IV

    // 6. Return as a Blob
    return new Blob([resultBuffer], { type: "application/octet-stream" });
  } catch (error) {
    console.error("Error encrypting RSA private key with AES key:", error);
    throw new Error(
      "Failed to encrypt RSA private key for backup using AES key."
    );
  }
}

/**
 * Decrypts an RSA Private Key JWK that was encrypted with an AES-GCM CryptoKey.
 * Expects the IV to be prepended to the ciphertext in the Blob.
 * @param encryptedKeyBlob A Blob containing the IV and the encrypted key.
 * @param aesKey The AES-GCM CryptoKey to use for decryption.
 * @returns A Promise that resolves to the decrypted RSA private key in JWK format.
 */
export async function decryptRsaPrivateKeyWithAesKey(
  encryptedKeyBlob: Blob,
  aesKey: CryptoKey
): Promise<JsonWebKey> {
  try {
    // 1. AES key is now provided directly.

    // 2. Convert the Blob to an ArrayBuffer
    const encryptedArrayBuffer = await encryptedKeyBlob.arrayBuffer();

    // 3. Ensure the ArrayBuffer is long enough to contain an IV and some data
    if (encryptedArrayBuffer.byteLength < 13) {
      // IV (12 bytes) + at least 1 byte of data
      throw new Error(
        "Encrypted key data is too short to contain IV and ciphertext."
      );
    }

    // 4. Extract the IV from the beginning of the ArrayBuffer
    const iv = new Uint8Array(encryptedArrayBuffer.slice(0, 12));

    // 5. Extract the ciphertext (the rest of the ArrayBuffer)
    const ciphertext = new Uint8Array(encryptedArrayBuffer.slice(12));

    // 6. Decrypt the ciphertext
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      ciphertext
    );

    // 7. Convert the decrypted ArrayBuffer back to a string, then parse as JSON
    const privateKeyString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(privateKeyString) as JsonWebKey;
  } catch (error) {
    console.error("Error decrypting RSA private key with AES key:", error);
    if (error.name === "OperationError") {
      throw new Error(
        "Failed to decrypt RSA private key with AES key. The AES key may be incorrect or the backup data is corrupted."
      );
    }
    throw new Error(
      "Failed to decrypt RSA private key due to an unexpected issue using AES key."
    );
  }
}
