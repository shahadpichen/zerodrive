import type {
  JsonObject,
  ZeroDriveSharedPrivateKey,
} from "@zerodrivehq/capsule";
import type { SharedFileMetadata } from "@zerodrive/shared-types";
import apiClient, { DirectoryPublicKey } from "./apiClient";
import {
  createSharedFileCapsule,
  createSharedMetadataCapsule,
  fingerprintSharingPublicKey,
  generateSharingRecipientKeyPair,
  openSharedFileCapsule,
  openSharedMetadataCapsule,
} from "./capsuleAdapter";
import logger from "./logger";
import { storeShareManagementCapability } from "./shareCapabilityStorage";

export interface UserKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export interface PreparedSharedFile {
  encryptedFileBlob: Blob;
  recipientEmail: string;
  customMessage?: string;
  encryptedMetadata: string;
  fileName: string;
  originalFileName: string;
  encryptedFileKey: null;
  fileId: string;
  mimeType: string;
  fileSize: number;
  contentFormat: "capsule_v1";
  recipientKeyVersion: number;
  recipientKeyFingerprint: string;
}

function sharedMetadataToJson(metadata: SharedFileMetadata): JsonObject {
  return {
    version: metadata.version,
    name: metadata.name,
    mimeType: metadata.mimeType,
    ...(metadata.message ? { message: metadata.message } : {}),
    ...(metadata.bindingId ? { bindingId: metadata.bindingId } : {}),
  };
}

function validateSharedMetadata(
  metadata: JsonObject,
  requireBindingId = false,
): SharedFileMetadata {
  if (
    metadata.version !== 1 ||
    typeof metadata.name !== "string" ||
    typeof metadata.mimeType !== "string" ||
    (metadata.message !== undefined && typeof metadata.message !== "string") ||
    (metadata.bindingId !== undefined &&
      (typeof metadata.bindingId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          metadata.bindingId,
        ))) ||
    (requireBindingId && typeof metadata.bindingId !== "string")
  ) {
    throw new Error("The encrypted file details have an unsupported format.");
  }
  return {
    version: 1,
    name: metadata.name,
    mimeType: metadata.mimeType,
    ...(typeof metadata.message === "string"
      ? { message: metadata.message }
      : {}),
    ...(typeof metadata.bindingId === "string"
      ? { bindingId: metadata.bindingId }
      : {}),
  };
}

export async function generateUserKeyPair(): Promise<UserKeyPair> {
  return generateSharingRecipientKeyPair();
}

export async function storeUserPublicKey(
  publicKeyJwk: JsonWebKey,
): Promise<{ keyVersion: number; fingerprint: string }> {
  try {
    const data = await apiClient.publicKeys.upsert(
      JSON.stringify(publicKeyJwk),
    );
    if (!data.key_version || !data.fingerprint) {
      throw new Error("Public sharing key version metadata is missing.");
    }
    const localFingerprint =
      await fingerprintSharingPublicKey(publicKeyJwk);
    if (data.fingerprint !== localFingerprint) {
      throw new Error("The public sharing key fingerprint does not match.");
    }
    return {
      keyVersion: data.key_version,
      fingerprint: data.fingerprint,
    };
  } catch (error) {
    logger.error("[Sharing] Public key registration failed", error);
    throw error;
  }
}

export async function fetchUserPublicKey(
  email: string,
): Promise<JsonWebKey | null> {
  const record = await fetchRecipientPublicKey(email);
  return record ? (JSON.parse(record.public_key) as JsonWebKey) : null;
}

export async function fetchRecipientPublicKey(
  email: string,
): Promise<DirectoryPublicKey | null> {
  const result = await apiClient.publicKeys.lookup(email);
  if (!result?.public_key) return null;

  try {
    const publicKey = JSON.parse(result.public_key) as JsonWebKey;
    const calculatedFingerprint =
      await fingerprintSharingPublicKey(publicKey);
    if (calculatedFingerprint !== result.fingerprint) {
      throw new Error("Recipient directory returned an invalid fingerprint.");
    }
    return result;
  } catch (error) {
    logger.warn("[Sharing] Recipient public key validation failed", error);
    throw error;
  }
}

export async function prepareFileForSharing(
  file: File,
  recipientEmail: string,
  customMessage?: string,
  pinnedRecipientKey?: DirectoryPublicKey,
): Promise<PreparedSharedFile> {
  const directoryKey =
    pinnedRecipientKey || (await fetchRecipientPublicKey(recipientEmail));
  if (!directoryKey) {
    throw new Error(
      "This recipient has not created a ZeroDrive sharing identity yet.",
    );
  }

  const publicKeyJwk = JSON.parse(directoryKey.public_key) as JsonWebKey;
  const recipient = {
    publicKeyJwk: publicKeyJwk as unknown as JsonObject,
    keyVersion: directoryKey.key_version,
    fingerprint: directoryKey.fingerprint,
  };
  const bindingId = crypto.randomUUID();
  const metadata: SharedFileMetadata = {
    version: 1,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    ...(customMessage ? { message: customMessage } : {}),
    bindingId,
  };
  const capsuleMetadata = sharedMetadataToJson(metadata);
  const [fileCapsule, metadataCapsule] = await Promise.all([
    createSharedFileCapsule({
      file,
      recipients: [recipient],
      metadata: capsuleMetadata,
    }),
    createSharedMetadataCapsule({
      recipients: [recipient],
      metadata: capsuleMetadata,
    }),
  ]);
  const fileId = crypto.randomUUID();

  return {
    encryptedFileBlob: fileCapsule.encryptedBlob,
    recipientEmail,
    ...(customMessage ? { customMessage } : {}),
    encryptedMetadata: metadataCapsule.encryptedMetadata,
    fileName: `encrypted_${fileId}.zd`,
    originalFileName: file.name,
    encryptedFileKey: null,
    fileId,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    contentFormat: "capsule_v1",
    recipientKeyVersion: directoryKey.key_version,
    recipientKeyFingerprint: directoryKey.fingerprint,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createManagementCapability(): Promise<{
  plaintext: string;
  hash: string;
}> {
  const plaintext = bytesToBase64Url(
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plaintext),
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { plaintext, hash };
}

export async function storeFileShare(
  shareId: string,
  _unusedDriveId: string,
  fileData: PreparedSharedFile,
  onFileUploaded?: () => void,
): Promise<void> {
  const managementCapability = await createManagementCapability();
  let pendingShareId: string | null = null;
  try {
    const expirationDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const data = await apiClient.sharedFiles.create({
      management_capability_hash: managementCapability.hash,
      recipient_email: fileData.recipientEmail,
      content_format: fileData.contentFormat,
      recipient_key_version: fileData.recipientKeyVersion,
      recipient_key_fingerprint: fileData.recipientKeyFingerprint,
      encrypted_file_key: null,
      encrypted_metadata: fileData.encryptedMetadata,
      file_size: fileData.fileSize,
      encrypted_size: fileData.encryptedFileBlob.size,
      access_type: "view",
      expires_at: expirationDate,
    });
    if (!data.id) {
      throw new Error("Share was created without an identifier.");
    }
    pendingShareId = data.id;

    await uploadEncryptedFile(
      data.id,
      managementCapability.plaintext,
      fileData.encryptedFileBlob,
    );
    onFileUploaded?.();
    await apiClient.sharedFiles.finalize(
      data.id,
      managementCapability.plaintext,
    );
    await storeShareManagementCapability(
      data.id,
      managementCapability.plaintext,
    );
    logger.log(`[Sharing] Share ${shareId} finalized`);
  } catch (error) {
    if (pendingShareId) {
      await apiClient.sharedFiles
        .delete(pendingShareId, managementCapability.plaintext)
        .catch(() => {});
    }
    logger.error("[Sharing] Share creation failed", error);
    throw error;
  }
}

export async function decryptSharedFile(input: {
  encryptedFileBlob: Blob;
  encryptedFileKey?: string | null;
  encryptedMetadata?: string | null;
  contentFormat: "legacy_zdse" | "capsule_v1";
  recipientPrivateKeys: ZeroDriveSharedPrivateKey[];
  fallbackName: string;
  fallbackMimeType: string;
  expectedBindingId?: string;
}): Promise<{
  decryptedFile: Blob;
  fileName: string;
  mimeType: string;
}> {
  if (
    input.contentFormat === "legacy_zdse" &&
    typeof input.encryptedFileKey !== "string"
  ) {
    throw new Error("The legacy encrypted file is missing its wrapped key.");
  }

  const opened = await openSharedFileCapsule({
    encryptedBlob: input.encryptedFileBlob,
    recipientPrivateKeyJwks: input.recipientPrivateKeys,
    ...(input.contentFormat === "legacy_zdse" && input.encryptedFileKey
      ? {
          legacy: {
            encryptedFileKey: input.encryptedFileKey,
            encryptedMetadata: input.encryptedMetadata,
          },
        }
      : {}),
  });
  if (opened.contentFormat !== input.contentFormat) {
    throw new Error(
      "The encrypted file format does not match its inbox record.",
    );
  }
  const metadata = validateSharedMetadata(
    opened.metadata,
    opened.contentFormat === "capsule_v1",
  );
  if (
    opened.contentFormat === "capsule_v1" &&
    (!input.expectedBindingId ||
      metadata.bindingId !== input.expectedBindingId)
  ) {
    throw new Error(
      "The encrypted file does not match its authenticated inbox details.",
    );
  }
  return {
    decryptedFile: opened.contentBlob,
    fileName: metadata.name || input.fallbackName,
    mimeType: metadata.mimeType || input.fallbackMimeType,
  };
}

export async function decryptSharedMetadata(input: {
  encryptedMetadata: string;
  encryptedFileKey?: string | null;
  contentFormat: "legacy_zdse" | "capsule_v1";
  recipientPrivateKeys: ZeroDriveSharedPrivateKey[];
}): Promise<SharedFileMetadata> {
  if (
    input.contentFormat === "legacy_zdse" &&
    typeof input.encryptedFileKey !== "string"
  ) {
    throw new Error("The legacy encrypted file is missing its wrapped key.");
  }

  const opened = await openSharedMetadataCapsule({
    encryptedMetadata: input.encryptedMetadata,
    recipientPrivateKeyJwks: input.recipientPrivateKeys,
    ...(input.contentFormat === "legacy_zdse" && input.encryptedFileKey
      ? {
          legacy: {
            encryptedMetadata: input.encryptedMetadata,
            encryptedFileKey: input.encryptedFileKey,
          },
        }
      : {}),
  });
  if (opened.contentFormat !== input.contentFormat) {
    throw new Error(
      "The encrypted metadata format does not match its inbox record.",
    );
  }
  return validateSharedMetadata(
    opened.metadata,
    opened.contentFormat === "capsule_v1",
  );
}

export async function uploadEncryptedFile(
  shareId: string,
  managementCapability: string,
  fileBlob: Blob,
): Promise<void> {
  const response = await apiClient.post(
    "/presigned-url/upload",
    { shareId },
    { "X-Share-Capability": managementCapability },
  );
  const { uploadUrl } = response.data as { uploadUrl: string };
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBlob,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
  }
}

export async function downloadEncryptedFile(shareId: string): Promise<Blob> {
  const response = await apiClient.post("/presigned-url/download", {
    shareId,
  });
  const { downloadUrl } = response.data as { downloadUrl: string };
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
  }
  return downloadResponse.blob();
}
