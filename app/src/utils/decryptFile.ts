export const decryptFile = async (fileBlob: Blob): Promise<Blob> => {
  try {
    const storedKey = localStorage.getItem("aes-gcm-key");
    if (!storedKey) {
      throw new Error("No encryption key found in local storage");
    }

    let keyJWK;
    try {
      keyJWK = JSON.parse(storedKey);
    } catch (parseError) {
      throw new Error("Invalid encryption key format in local storage");
    }

    if (!keyJWK || !keyJWK.k || !keyJWK.kty || keyJWK.kty !== "oct") {
      throw new Error("Invalid encryption key format");
    }

    // Import the key
    let key;
    try {
      key = await crypto.subtle.importKey(
        "jwk",
        keyJWK,
        { name: "AES-GCM" },
        true,
        ["decrypt"]
      );
    } catch (keyImportError) {
      console.error("Key import error:", keyImportError);
      throw new Error(
        "Could not import encryption key: " + keyImportError.message
      );
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
    } catch (decryptError) {
      console.error("Decryption operation error:", decryptError);

      // Check for specific error types
      if (decryptError.name === "OperationError") {
        throw new Error(
          "Decryption failed: the encryption key doesn't match the one used to encrypt this file"
        );
      } else {
        throw new Error("Decryption failed: " + decryptError.message);
      }
    }
  } catch (error) {
    console.error("Decryption error:", error);
    throw error; // Re-throw to be handled by the caller
  }
};
