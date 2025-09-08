/**
 * @file fileSharing.ts
 * Implements secure file sharing functionality using asymmetric cryptography and Supabase.
 */

import supabase from "./supabaseClient";
import { getUserKeyPair } from "./keyStorage";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Represents the result of preparing a file for sharing (Step 1).
 */
export interface FilePreparationResult {
  /** The encrypted file content as a Blob. The IV is prepended to this blob. */
  encryptedFileBlob: Blob;
  /** SHA-256 hash of the recipient's email address. */
  recipientEmailHash: string;
  /** The file's symmetric encryption key, itself encrypted for the recipient. */
  encryptedFileKeyForRecipient: ArrayBuffer;
  /** A cryptographic proof of the sender's identity. */
  senderProof: string;
  /** The original name of the file. */
  fileName: string;
  /** The original MIME type of the file. */
  fileMimeType: string;
}

/**
 * Represents a key pair for asymmetric cryptography.
 */
export interface UserKeyPair {
  /** The public key as a JsonWebKey object. */
  publicKeyJwk: JsonWebKey;
  /** The private key as a JsonWebKey object. */
  privateKeyJwk: JsonWebKey;
}

/**
 * Converts an ArrayBuffer to a hexadecimal string.
 * @param buffer The ArrayBuffer to convert.
 * @returns A hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes an email address using SHA-256.
 * Emails are converted to lowercase and trimmed before hashing.
 * @param email The email address to hash.
 * @returns A Promise that resolves to the SHA-256 hash as a hex string.
 */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Encrypts file content using AES-GCM with a provided CryptoKey.
 * The 12-byte Initialization Vector (IV) is prepended to the resulting Blob.
 * @param file The file to encrypt.
 * @param key The AES-GCM CryptoKey to use for encryption.
 * @returns A Promise that resolves to a Blob containing the IV prepended to the ciphertext.
 */
async function encryptFileContentWithKey(
  file: File,
  key: CryptoKey
): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV size
  const fileArrayBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileArrayBuffer
  );

  const resultBuffer = new Uint8Array(
    iv.byteLength + encryptedBuffer.byteLength
  );
  resultBuffer.set(iv, 0);
  resultBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength);

  return new Blob([resultBuffer], { type: file.type });
}

/**
 * Generates a new RSA key pair for a user.
 * @returns A Promise that resolves to a UserKeyPair containing both public and private keys as JWK.
 */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  // Generate an RSA key pair for encryption
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"] // key usages
  );

  // Export the keys to JWK format for storage
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );

  return {
    publicKeyJwk,
    privateKeyJwk,
  };
}

/**
 * Stores a user's public key in Supabase, associated with their hashed email.
 * @param hashedEmail The SHA-256 hash of the user's email.
 * @param publicKeyJwk The user's public key in JWK format.
 * @returns A Promise that resolves when the key is stored.
 */
export async function storeUserPublicKey(
  hashedEmail: string,
  publicKeyJwk: JsonWebKey
): Promise<void> {
  try {
    console.log("Attempting to store public key in Supabase...");
    console.log("Target table: user_public_keys");
    console.log("Hashed email:", hashedEmail);

    const { error, data } = await supabase.from("user_public_keys").upsert(
      {
        hashed_email_identifier: hashedEmail,
        public_key_jwk: publicKeyJwk,
      },
      {
        onConflict: "hashed_email_identifier",
      }
    );

    if (error) {
      console.error("Supabase error details:", error);
      throw new Error(
        `Failed to store public key: ${error.message} (Code: ${error.code})`
      );
    }

    console.log("Public key stored successfully");
  } catch (error) {
    console.error("Error in storeUserPublicKey:", error);

    // Check if it's a Supabase error or a more general error
    if (error instanceof Error) {
      throw error; // Re-throw the error with its original message
    } else {
      throw new Error(`Failed to store public key: Unknown error`);
    }
  }
}

/**
 * Fetches a user's public key from Supabase using their hashed email.
 * @param hashedEmail The SHA-256 hash of the user's email.
 * @returns A Promise that resolves to the user's public key as a CryptoKey, or null if not found.
 */
export async function fetchUserPublicKey(
  hashedEmail: string
): Promise<CryptoKey | null> {
  const { data, error } = await supabase
    .from("user_public_keys")
    .select("public_key_jwk")
    .eq("hashed_email_identifier", hashedEmail)
    .single();

  if (error || !data) {
    console.warn(`Public key not found for hashed email: ${hashedEmail}`);
    return null;
  }

  try {
    // Import the JWK as a CryptoKey
    return await crypto.subtle.importKey(
      "jwk",
      data.public_key_jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true, // extractable
      ["encrypt"] // key usage
    );
  } catch (importError: any) {
    console.error("Error importing public key:", importError);
    throw new Error(`Failed to import public key: ${importError.message}`);
  }
}

/**
 * Encrypts the file key for a recipient using their public key.
 * @param fileKey The symmetric file encryption key (AES-GCM).
 * @param recipientEmail The email of the recipient.
 * @returns A Promise that resolves to an ArrayBuffer containing the encrypted file key.
 */
export async function encryptFileKeyForRecipient(
  fileKey: CryptoKey,
  recipientEmail: string
): Promise<ArrayBuffer> {
  // 1. Hash the recipient's email
  const hashedRecipientEmail = await hashEmail(recipientEmail);

  // 2. Fetch the recipient's public key
  const recipientPublicKey = await fetchUserPublicKey(hashedRecipientEmail);
  if (!recipientPublicKey) {
    throw new Error(
      `Recipient ${recipientEmail} has not registered a public key.`
    );
  }

  // 3. Export the file key to raw bytes
  const exportedFileKeyBuffer = await crypto.subtle.exportKey("raw", fileKey);

  // 4. Encrypt the file key with the recipient's public key
  return await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    recipientPublicKey,
    exportedFileKeyBuffer
  );
}

/**
 * Generates a cryptographic proof of the sender's identity.
 * This is a simplified version that uses email verification and the current timestamp.
 * In a more sophisticated system, this could be a signed JWT or another cryptographic assertion.
 * @param senderEmail The sender's email identifier.
 * @returns A Promise that resolves to a string representing the sender proof.
 */
export async function generateSenderProof(
  senderEmail: string
): Promise<string> {
  // For a basic proof, we'll use the hash of the sender's email and timestamp
  const encoder = new TextEncoder();
  const timestamp = Date.now().toString();
  const data = encoder.encode(
    `${senderEmail.toLowerCase().trim()}-${timestamp}`
  );
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const proof = bufferToHex(hashBuffer);

  return `${timestamp}:${proof}`;
}

/**
 * Convert an ArrayBuffer to Base64 string
 * @param buffer The ArrayBuffer to convert
 * @returns Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to ArrayBuffer
 * @param base64 The Base64 string to convert
 * @returns ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    // Clean up the base64 string
    let cleanBase64 = base64;

    // Remove data URL prefix if present
    if (cleanBase64.includes("base64,")) {
      cleanBase64 = cleanBase64.split("base64,")[1];
    }

    // Handle URL-safe base64 (replace - with + and _ with /)
    cleanBase64 = cleanBase64.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if needed
    while (cleanBase64.length % 4) {
      cleanBase64 += "=";
    }

    // Now decode
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("Base64 decode error:", error);
    throw new Error("Failed to decode base64 string");
  }
}

/**
 * Prepares a file for sharing.
 * This involves:
 * 1. Generating a unique symmetric key for the file.
 * 2. Encrypting the file content with this key.
 * 3. Hashing the recipient's email.
 * 4. Encrypting the file key for the recipient using their public key.
 * 5. Generating a sender identity proof.
 *
 * @param file The file to be shared.
 * @param recipientEmail The email address of the intended recipient.
 * @param senderEmail The email address of the sender (used for generating sender proof).
 * @returns A Promise that resolves to a FilePreparationResult object containing all necessary components.
 */
export async function prepareFileForSharing(
  file: File,
  recipientEmail: string,
  senderEmail: string
): Promise<{
  encryptedFileBlob: Blob;
  recipientHashedEmail: string;
  senderHashedEmail: string;
  fileName: string;
  originalFileName: string;
  encryptedFileKey: string;
  fileId: string;
  mimeType: string;
  fileSize: number;
  senderProof: string;
}> {
  try {
    // Get the sender's private key
    const senderKeyPair = await getUserKeyPair(senderEmail);
    if (!senderKeyPair) {
      throw new Error(
        "Sender private key not found. Please generate your keys first."
      );
    }

    // We don't need to import the sender's private key for this operation,
    // as we only need the recipient's public key to encrypt the file key

    // Hash the recipient's email
    const recipientHashedEmail = await hashEmail(recipientEmail);

    // Get the recipient's public key from the database
    // const recipientPublicKey = await fetchUserPublicKey(recipientHashedEmail);

    // Fetch the recipient's public key JWK directly for logging and use
    const { data: publicKeyData, error: publicKeyFetchError } = await supabase
      .from("user_public_keys")
      .select("public_key_jwk")
      .eq("hashed_email_identifier", recipientHashedEmail)
      .single();

    if (
      publicKeyFetchError ||
      !publicKeyData ||
      !publicKeyData.public_key_jwk
    ) {
      console.error(
        `[SENDER-DEBUG] Failed to fetch public key JWK for ${recipientEmail} (hashed: ${recipientHashedEmail}):`,
        publicKeyFetchError
      );
      throw new Error(
        `Recipient ${recipientEmail} has not registered their public key yet, or an error occurred fetching it.`
      );
    }
    const recipientPublicJWKForEncryption = publicKeyData.public_key_jwk;
    console.log(
      `[SENDER-DEBUG] Public Key JWK of recipient (${recipientEmail}) being used for encryption:`,
      JSON.stringify(recipientPublicJWKForEncryption)
    );

    // Import this specific JWK to a CryptoKey for encryption
    const recipientPublicKeyCryptoKey = await crypto.subtle.importKey(
      "jwk",
      recipientPublicJWKForEncryption,
      { name: "RSA-OAEP", hash: "SHA-256" }, // Assuming SHA-256 based on your key alg
      true, // Needs to be true for 'encrypt' if that's the only usage, or if key_ops in JWK allows
      ["encrypt"]
    );

    if (!recipientPublicKeyCryptoKey) {
      // Simplified check, was !recipientPublicKey before
      throw new Error(
        `Recipient ${recipientEmail} has not registered their public key yet, or an error occurred fetching it.`
      );
    }

    // Generate a random symmetric key for file encryption
    const fileKey = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );

    // Export the file key to raw format
    const fileKeyRaw = await crypto.subtle.exportKey("raw", fileKey);

    // Encrypt the file key with the recipient's public key
    const encryptedFileKey = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      recipientPublicKeyCryptoKey,
      fileKeyRaw
    );

    // Read the file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Generate a random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the file with the symmetric key
    const encryptedFile = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      fileKey,
      fileBuffer
    );

    // Combine IV and encrypted file
    const encryptedFileWithIV = new Uint8Array(
      iv.length + encryptedFile.byteLength
    );
    encryptedFileWithIV.set(iv, 0);
    encryptedFileWithIV.set(new Uint8Array(encryptedFile), iv.length);

    // Create a Blob from the encrypted file
    const encryptedFileBlob = new Blob([encryptedFileWithIV], {
      type: "application/octet-stream",
    });

    // Hash the sender's email
    const senderHashedEmail = await hashEmail(senderEmail);

    // Generate a random file ID
    const fileId = crypto.randomUUID();

    // Create a unique encrypted file name
    const fileExtension = file.name.split(".").pop() || "";
    const fileName = `encrypted_${fileId}.bin`;

    // After generating fileId
    const senderProof = `${Date.now()}:dummy-proof`;

    return {
      encryptedFileBlob,
      recipientHashedEmail,
      senderHashedEmail,
      fileName,
      originalFileName: file.name,
      encryptedFileKey: arrayBufferToBase64(encryptedFileKey),
      fileId,
      mimeType: file.type,
      fileSize: file.size,
      senderProof,
    };
  } catch (error) {
    console.error("Error preparing file for sharing:", error);
    throw error;
  }
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return (
    "\\x" +
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Store file sharing information in Supabase
 */
export async function storeFileShare(
  shareId: string,
  _unusedDriveId: string,
  fileData: any
): Promise<void> {
  try {
    // 1. Upload file to Supabase Storage using S3 client
    const filePath = `shared-files/${shareId}`;

    // Use the S3 client instead of supabase.storage
    await uploadEncryptedFile(filePath, fileData.encryptedFileBlob);

    // 2. Store metadata in database, with reference to file in storage
    const encryptedFileKeyArrayBuffer = base64ToArrayBuffer(
      fileData.encryptedFileKey
    );
    // Convert ArrayBuffer to a hex string for BYTEA storage
    const encryptedFileKeyHex = arrayBufferToHex(encryptedFileKeyArrayBuffer);

    console.log(
      `[SENDER-DEBUG] Storing encryptedFileKey for share_id ${shareId}. Original base64: "${fileData.encryptedFileKey}", Hex for DB: "${encryptedFileKeyHex}" (length: ${encryptedFileKeyHex.length})`
    );

    const { data, error } = await supabase.from("shared_files").insert({
      share_id: shareId,
      encrypted_file_blob_id: filePath, // Reference to storage location
      recipient_email_hash: fileData.recipientHashedEmail,
      encrypted_file_key: encryptedFileKeyHex, // Store the hex string
      sender_proof: fileData.senderProof,
      file_name: fileData.originalFileName,
      file_mime_type: fileData.mimeType,
      file_size: fileData.fileSize,
    });

    if (error) {
      console.error("Error inserting into shared_files:", error);
      throw error;
    }
    console.log(`[SENDER-DEBUG] Successfully stored share_id ${shareId}`);
  } catch (error) {
    console.error("Error in storeFileShare:", error);
    throw error;
  }
}

/**
 * Finds all files shared with a specific recipient, based on their email.
 * @param recipientEmail The email address of the recipient.
 * @returns A Promise that resolves to an array of shared file metadata.
 */
export async function findFilesSharedWithRecipient(
  recipientEmail: string
): Promise<any[]> {
  // Hash the recipient's email to look up in the database
  const recipientEmailHash = await hashEmail(recipientEmail);

  const { data, error } = await supabase
    .from("shared_files")
    .select("*")
    .eq("recipient_email_hash", recipientEmailHash)
    .eq("is_claimed", false);

  if (error) {
    throw new Error(`Failed to fetch shared files: ${error.message}`);
  }

  return data || [];
}

/**
 * Marks a shared file as claimed by the recipient.
 * @param shareId The unique identifier for the share.
 * @returns A Promise that resolves when the share is successfully marked as claimed.
 */
export async function markFileShareAsClaimed(shareId: string): Promise<void> {
  const { error } = await supabase
    .from("shared_files")
    .update({ is_claimed: true })
    .eq("share_id", shareId);

  if (error) {
    throw new Error(`Failed to mark file as claimed: ${error.message}`);
  }
}

/**
 * Decrypt a shared file for the current user
 * @param encryptedFileBlob The encrypted file blob
 * @param encryptedFileKey The encrypted file key
 * @param userEmail The current user's email
 * @param originalFileName The original file name
 * @param mimeType The original MIME type
 */
export async function decryptSharedFile(
  encryptedFileBlob: Blob,
  encryptedFileKey: string,
  userEmail: string,
  originalFileName: string,
  mimeType: string
): Promise<{
  decryptedFile: Blob;
  fileName: string;
}> {
  try {
    // Get the user's private key
    const userKeyPair = await getUserKeyPair(userEmail);
    if (!userKeyPair || !userKeyPair.privateKeyJwk) {
      throw new Error(
        "Private key JWK not found. Please ensure keys are generated and retrieved correctly."
      );
    }

    console.log("Attempting decryption for user:", userEmail);
    console.log("Encrypted File Key (base64):", encryptedFileKey);
    console.log("Private Key JWK:", userKeyPair.privateKeyJwk);

    const jwk = userKeyPair.privateKeyJwk;
    let importParams;
    let decryptParams;

    // Determine parameters based on the JWK's 'alg' field
    // RSA-OAEP-256 implies RSA-OAEP with SHA-256
    if (jwk.alg === "RSA-OAEP-256") {
      importParams = { name: "RSA-OAEP", hash: { name: "SHA-256" } };
      decryptParams = { name: "RSA-OAEP" }; // Hash is part of the key after import
      console.log("Using RSA-OAEP with SHA-256 based on JWK alg.");
    } else if (jwk.alg === "RSA-OAEP" || jwk.alg === "RSA-OAEP-1") {
      // Common for SHA-1
      importParams = { name: "RSA-OAEP", hash: { name: "SHA-1" } };
      decryptParams = { name: "RSA-OAEP" };
      console.log("Using RSA-OAEP with SHA-1 based on JWK alg.");
    } else {
      // Fallback or throw error if alg is unexpected
      console.warn("Unexpected JWK alg:", jwk.alg, "Defaulting to SHA-256.");
      importParams = { name: "RSA-OAEP", hash: { name: "SHA-256" } };
      decryptParams = { name: "RSA-OAEP" };
    }

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      importParams,
      false, // Not extractable
      ["decrypt"]
    );
    console.log("Private key imported successfully.");

    const encryptedFileKeyArray = base64ToArrayBuffer(encryptedFileKey);
    if (!encryptedFileKeyArray || encryptedFileKeyArray.byteLength === 0) {
      throw new Error("Converted encryptedFileKeyArray is empty or invalid.");
    }
    console.log(
      "Encrypted file key ArrayBuffer length:",
      encryptedFileKeyArray.byteLength
    );

    const fileKeyRaw = await crypto.subtle.decrypt(
      decryptParams,
      privateKey,
      encryptedFileKeyArray
    );
    console.log("File key decrypted successfully.");

    // Import the file key (AES-GCM)
    const fileKey = await crypto.subtle.importKey(
      "raw",
      fileKeyRaw,
      {
        name: "AES-GCM",
        length: 256, // Ensure this matches encryption
      },
      false, // Not extractable
      ["decrypt"]
    );
    console.log("AES-GCM symmetric key imported successfully.");

    // Read the encrypted file as ArrayBuffer
    const encryptedFileWithIV = await encryptedFileBlob.arrayBuffer();

    // Extract the IV (first 12 bytes) and encrypted file data
    const iv = new Uint8Array(encryptedFileWithIV.slice(0, 12));
    const encryptedFile = new Uint8Array(encryptedFileWithIV.slice(12));
    console.log(
      "IV length:",
      iv.byteLength,
      "Encrypted data length:",
      encryptedFile.byteLength
    );

    // Decrypt the file content
    const decryptedFile = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      fileKey,
      encryptedFile
    );
    console.log("File content decrypted successfully.");

    // Create a Blob from the decrypted file
    const decryptedBlob = new Blob([decryptedFile], {
      type: mimeType || "application/octet-stream",
    });

    return {
      decryptedFile: decryptedBlob,
      fileName: originalFileName,
    };
  } catch (error: any) {
    console.error(
      "Error decrypting shared file:",
      error.name,
      error.message,
      error.stack
    );
    // Provide a more user-friendly error or re-throw with more context
    if (error.name === "OperationError") {
      throw new Error(
        `Decryption failed: The provided key is likely incorrect or the data is corrupted. (Details: ${error.message})`
      );
    }
    throw error; // Re-throw other errors
  }
}

// Get the user's session token
export async function getS3Client() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // For testing - skip session check and use anon key directly
  return new S3Client({
    forcePathStyle: true,
    region: process.env.REACT_APP_AWS_REGION || "",
    endpoint: process.env.REACT_APP_AWS_ENDPOINT_URL || "",
    credentials: {
      accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || "",
      // Use an empty session token to bypass authentication for now
      sessionToken: session?.access_token || "",
    },
  });
}

// Upload file
export async function uploadEncryptedFile(filePath: string, fileBlob: Blob) {
  // Convert Blob to ArrayBuffer
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer); // Convert to Uint8Array

  const client = await getS3Client();
  const command = new PutObjectCommand({
    Bucket: "secure-files",
    Key: filePath,
    Body: uint8Array, // Use Uint8Array
    ContentType: "application/octet-stream",
  });

  return client.send(command);
}

// Download file
export async function downloadEncryptedFile(filePath: string) {
  const client = await getS3Client();
  const command = new GetObjectCommand({
    Bucket: "secure-files",
    Key: filePath,
  });

  const response = await client.send(command);
  return response.Body;
}

// Delete file from Supabase Storage (S3)
export async function deleteFileFromSupabaseStorage(
  filePath: string
): Promise<void> {
  const client = await getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: "secure-files", // Make sure this matches your bucket name
    Key: filePath,
  });

  try {
    await client.send(command);
    console.log(`Successfully deleted ${filePath} from Supabase Storage.`);
  } catch (error: any) {
    console.error(`Failed to delete ${filePath} from Supabase Storage:`, error);
    // Optionally re-throw or handle as per application needs, e.g., toast notification
    throw new Error(`Failed to delete from storage: ${error.message}`);
  }
}
