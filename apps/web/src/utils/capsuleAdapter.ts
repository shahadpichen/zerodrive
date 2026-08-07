import {
  CapsuleError,
  ZERO_DRIVE_FORMATS,
  createZeroDrivePersonalFileCapsule,
  createZeroDriveSharedFileCapsule,
  createZeroDriveSharedMetadataCapsule,
  createZeroDriveSharingKeyBackup,
  createZeroDriveVaultIndexCapsule,
  fingerprintPublicKey,
  generateRecipientKeyPair,
  generateRecoveryPhrase,
  isCapsule,
  normalizeRecoveryPhrase,
  openZeroDrivePersonalFile,
  openZeroDriveSharedFile,
  openZeroDriveSharedMetadataCapsule,
  openZeroDriveSharingKeyBackup,
  openZeroDriveVaultIndex,
  parseCapsuleHeader,
  validateRecoveryPhrase,
  type CapsuleRecipientHeader,
  type JsonObject,
  type JsonValue,
  type ZeroDriveEncryptedFormat,
  type ZeroDriveSharedPrivateKey,
  type ZeroDriveSharedRecipient,
} from "@zerodrivehq/capsule";
import { getStoredKey } from "./cryptoUtils";
import { getMnemonic } from "./mnemonicManager";

export type CapsuleContentFormat = ZeroDriveEncryptedFormat;

export type CapsuleApplicationErrorCode =
  | "ACCESS_REQUIRED"
  | "INVALID_RECOVERY_PHRASE"
  | "RECOVERY_PHRASE_MISMATCH"
  | "NO_MATCHING_SHARING_KEY"
  | "ENCRYPTED_DATA_DAMAGED"
  | "UNSUPPORTED_ENCRYPTED_FORMAT"
  | "ENCRYPTION_FAILED";

const CAPSULE_ERROR_MESSAGES: Record<CapsuleApplicationErrorCode, string> = {
  ACCESS_REQUIRED:
    "Open Recovery & Access and enter the recovery phrase for this vault.",
  INVALID_RECOVERY_PHRASE:
    "That recovery phrase is not valid. Check the words and their order.",
  RECOVERY_PHRASE_MISMATCH:
    "This recovery phrase cannot open the encrypted data.",
  NO_MATCHING_SHARING_KEY:
    "This sharing identity cannot open the encrypted file.",
  ENCRYPTED_DATA_DAMAGED:
    "The encrypted data could not be verified. It may be incomplete or damaged.",
  UNSUPPORTED_ENCRYPTED_FORMAT:
    "This encrypted format is not supported by this version of ZeroDrive.",
  ENCRYPTION_FAILED: "ZeroDrive could not complete the encryption operation.",
};

export class CapsuleApplicationError extends Error {
  readonly code: CapsuleApplicationErrorCode;

  constructor(code: CapsuleApplicationErrorCode, cause?: unknown) {
    super(CAPSULE_ERROR_MESSAGES[code]);
    this.name = "CapsuleApplicationError";
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: cause,
      });
    }
  }
}

function mapCapsuleError(
  error: unknown,
  accessKind: "recovery" | "sharing" = "recovery",
): CapsuleApplicationError {
  if (error instanceof CapsuleApplicationError) return error;

  if (error instanceof CapsuleError) {
    switch (error.code) {
      case "INVALID_RECOVERY_PHRASE":
        return new CapsuleApplicationError("INVALID_RECOVERY_PHRASE", error);
      case "CAPSULE_ACCESS_REQUIRED":
        return new CapsuleApplicationError("ACCESS_REQUIRED", error);
      case "CAPSULE_NO_MATCHING_KEY":
      case "CAPSULE_KEY_UNWRAP_FAILED":
        return new CapsuleApplicationError(
          accessKind === "sharing"
            ? "NO_MATCHING_SHARING_KEY"
            : "RECOVERY_PHRASE_MISMATCH",
          error,
        );
      case "CAPSULE_UNSUPPORTED_SUITE":
      case "CAPSULE_UNSUPPORTED_VERSION":
        return new CapsuleApplicationError(
          "UNSUPPORTED_ENCRYPTED_FORMAT",
          error,
        );
      case "CAPSULE_AUTHENTICATION_FAILED":
      case "CAPSULE_MALFORMED":
      case "CAPSULE_METADATA_INVALID":
      case "LEGACY_SHARED_FILE_INVALID":
      case "INVALID_ENCRYPTED_FILE":
      case "DECRYPTION_FAILED":
        return new CapsuleApplicationError("ENCRYPTED_DATA_DAMAGED", error);
      default:
        return new CapsuleApplicationError("ENCRYPTION_FAILED", error);
    }
  }

  return new CapsuleApplicationError("ENCRYPTION_FAILED", error);
}

function requireRecoveryPhrase(): string {
  const phrase = getMnemonic();
  if (!phrase) {
    throw new CapsuleApplicationError("ACCESS_REQUIRED");
  }
  return normalizeRecoveryPhrase(phrase);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function bytesToBlob(
  bytes: Uint8Array,
  type = "application/octet-stream",
): Blob {
  const copy = copyBytes(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type });
}

export function generateVaultRecoveryPhrase(): string {
  return generateRecoveryPhrase();
}

export function normalizeVaultRecoveryPhrase(phrase: string): string {
  return normalizeRecoveryPhrase(phrase);
}

export function validateVaultRecoveryPhrase(phrase: string): boolean {
  return validateRecoveryPhrase(phrase);
}

export async function generateSharingRecipientKeyPair() {
  return generateRecipientKeyPair();
}

export async function fingerprintSharingPublicKey(
  publicKeyJwk: JsonWebKey,
): Promise<string> {
  return fingerprintPublicKey(publicKeyJwk);
}

export async function createPersonalFileCapsule(
  file: File,
  objectId: string,
  recoveryPhrase?: string,
): Promise<{
  encryptedBlob: Blob;
  contentFormat: CapsuleContentFormat;
}> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      objectId,
    )
  ) {
    throw new CapsuleApplicationError("ENCRYPTION_FAILED");
  }
  const content = await blobToBytes(file);
  try {
    const bytes = await createZeroDrivePersonalFileCapsule({
      content,
      metadata: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        objectId,
        revision: 1,
      },
      recoveryPhrase: recoveryPhrase
        ? normalizeRecoveryPhrase(recoveryPhrase)
        : requireRecoveryPhrase(),
    });
    try {
      return {
        encryptedBlob: bytesToBlob(bytes),
        contentFormat: ZERO_DRIVE_FORMATS.CAPSULE_V1,
      };
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error);
  } finally {
    content.fill(0);
  }
}

export async function openPersonalFileCapsule(encryptedBlob: Blob): Promise<{
  contentBlob: Blob;
  metadata: JsonObject;
  contentFormat: CapsuleContentFormat;
}> {
  const encryptedBytes = await blobToBytes(encryptedBlob);
  try {
    if (isCapsule(encryptedBytes) && !getMnemonic()) {
      throw new CapsuleApplicationError("ACCESS_REQUIRED");
    }
    const opened = await openZeroDrivePersonalFile({
      encryptedBytes,
      recoveryPhrase: getMnemonic() ?? undefined,
      legacyAesKey: (await getStoredKey()) ?? undefined,
    });
    const mimeType =
      typeof opened.metadata.mimeType === "string"
        ? opened.metadata.mimeType
        : "application/octet-stream";
    try {
      return {
        contentBlob: bytesToBlob(opened.content, mimeType),
        metadata: opened.metadata,
        contentFormat: opened.format,
      };
    } finally {
      opened.content.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error);
  } finally {
    encryptedBytes.fill(0);
  }
}

export async function createVaultIndexCapsule(
  index: JsonValue,
  recoveryPhrase?: string,
): Promise<{
  encryptedBlob: Blob;
  contentFormat: CapsuleContentFormat;
}> {
  try {
    const bytes = await createZeroDriveVaultIndexCapsule({
      index,
      recoveryPhrase: recoveryPhrase
        ? normalizeRecoveryPhrase(recoveryPhrase)
        : requireRecoveryPhrase(),
    });
    try {
      return {
        encryptedBlob: bytesToBlob(bytes),
        contentFormat: ZERO_DRIVE_FORMATS.CAPSULE_V1,
      };
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error);
  }
}

export async function openVaultIndexCapsule(encryptedBlob: Blob): Promise<{
  index: JsonValue;
  contentFormat: CapsuleContentFormat;
}> {
  const encryptedBytes = await blobToBytes(encryptedBlob);
  try {
    if (isCapsule(encryptedBytes) && !getMnemonic()) {
      throw new CapsuleApplicationError("ACCESS_REQUIRED");
    }
    const opened = await openZeroDriveVaultIndex({
      encryptedBytes,
      recoveryPhrase: getMnemonic() ?? undefined,
      legacyAesKey: (await getStoredKey()) ?? undefined,
    });
    return { index: opened.index, contentFormat: opened.format };
  } catch (error) {
    throw mapCapsuleError(error);
  } finally {
    encryptedBytes.fill(0);
  }
}

export async function openVaultIndexCapsuleWithRecoveryPhraseOnly(
  encryptedBlob: Blob,
  recoveryPhrase: string,
): Promise<{
  index: JsonValue;
  contentFormat: CapsuleContentFormat;
}> {
  const encryptedBytes = await blobToBytes(encryptedBlob);
  try {
    const opened = await openZeroDriveVaultIndex({
      encryptedBytes,
      recoveryPhrase: normalizeRecoveryPhrase(recoveryPhrase),
    });
    return { index: opened.index, contentFormat: opened.format };
  } catch (error) {
    throw mapCapsuleError(error);
  } finally {
    encryptedBytes.fill(0);
  }
}

export async function createSharedFileCapsule(input: {
  file: File;
  recipients: ZeroDriveSharedRecipient[];
  metadata: JsonObject;
}): Promise<{
  encryptedBlob: Blob;
  contentFormat: CapsuleContentFormat;
}> {
  const content = await blobToBytes(input.file);
  try {
    const bytes = await createZeroDriveSharedFileCapsule({
      content,
      metadata: input.metadata,
      recipients: input.recipients,
    });
    try {
      return {
        encryptedBlob: bytesToBlob(bytes),
        contentFormat: ZERO_DRIVE_FORMATS.CAPSULE_V1,
      };
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error, "sharing");
  } finally {
    content.fill(0);
  }
}

export async function createSharedMetadataCapsule(input: {
  metadata: JsonObject;
  recipients: ZeroDriveSharedRecipient[];
}): Promise<{
  encryptedMetadata: string;
  contentFormat: CapsuleContentFormat;
}> {
  try {
    const bytes = await createZeroDriveSharedMetadataCapsule(input);
    try {
      return {
        encryptedMetadata: bytesToBase64(bytes),
        contentFormat: ZERO_DRIVE_FORMATS.CAPSULE_V1,
      };
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error, "sharing");
  }
}

export async function openSharedMetadataCapsule(input: {
  encryptedMetadata: string;
  recipientPrivateKeyJwks: ZeroDriveSharedPrivateKey[];
  legacy?: { encryptedFileKey: string; encryptedMetadata: string };
}): Promise<{
  metadata: JsonObject;
  contentFormat: CapsuleContentFormat;
}> {
  const encryptedBytes = base64ToBytes(input.encryptedMetadata);
  try {
    const opened = await openZeroDriveSharedMetadataCapsule({
      encryptedBytes,
      recipientPrivateKeyJwks: input.recipientPrivateKeyJwks,
      legacy: input.legacy,
    });
    return { metadata: opened.metadata, contentFormat: opened.format };
  } catch (error) {
    throw mapCapsuleError(error, "sharing");
  } finally {
    encryptedBytes.fill(0);
  }
}

export function inspectSharedMetadataCapsule(
  encryptedMetadata: string,
): CapsuleRecipientHeader[] {
  const encryptedBytes = base64ToBytes(encryptedMetadata);
  try {
    return parseCapsuleHeader(encryptedBytes).recipients.map((recipient) => ({
      ...recipient,
    }));
  } catch (error) {
    throw mapCapsuleError(error, "sharing");
  } finally {
    encryptedBytes.fill(0);
  }
}

export async function openSharedFileCapsule(input: {
  encryptedBlob: Blob;
  recipientPrivateKeyJwks: ZeroDriveSharedPrivateKey[];
  legacy?: {
    encryptedFileKey: string;
    encryptedMetadata?: string | null;
  };
}): Promise<{
  contentBlob: Blob;
  metadata: JsonObject;
  contentFormat: CapsuleContentFormat;
}> {
  const encryptedBytes = await blobToBytes(input.encryptedBlob);
  try {
    const opened = await openZeroDriveSharedFile({
      encryptedBytes,
      recipientPrivateKeyJwks: input.recipientPrivateKeyJwks,
      legacy: input.legacy,
    });
    const mimeType =
      typeof opened.metadata.mimeType === "string"
        ? opened.metadata.mimeType
        : "application/octet-stream";
    try {
      return {
        contentBlob: bytesToBlob(opened.content, mimeType),
        metadata: opened.metadata,
        contentFormat: opened.format,
      };
    } finally {
      opened.content.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error, "sharing");
  } finally {
    encryptedBytes.fill(0);
  }
}

export async function createSharingKeyBackupCapsule(input: {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  keyVersion: number;
  fingerprint: string;
  recoveryPhrase?: string;
}): Promise<Blob> {
  try {
    const bytes = await createZeroDriveSharingKeyBackup({
      privateKeyJwk: input.privateKeyJwk as unknown as JsonObject,
      publicKeyJwk: input.publicKeyJwk as unknown as JsonObject,
      recoveryPhrase:
        input.recoveryPhrase === undefined
          ? requireRecoveryPhrase()
          : normalizeRecoveryPhrase(input.recoveryPhrase),
      keyVersion: input.keyVersion,
      fingerprint: input.fingerprint,
    });
    try {
      return bytesToBlob(bytes);
    } finally {
      bytes.fill(0);
    }
  } catch (error) {
    throw mapCapsuleError(error);
  }
}

export async function openSharingKeyBackupCapsule(
  encryptedBlob: Blob,
  recoveryPhrase = requireRecoveryPhrase(),
  options: { legacyPbkdf2Salt?: string; legacyKeyVersion?: number } = {},
) {
  const encryptedBytes = await blobToBytes(encryptedBlob);
  try {
    return await openZeroDriveSharingKeyBackup({
      encryptedBytes,
      recoveryPhrase: normalizeRecoveryPhrase(recoveryPhrase),
      ...options,
    });
  } catch (error) {
    throw mapCapsuleError(error);
  } finally {
    encryptedBytes.fill(0);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
