/**
 * Encrypts and decrypts the private vault index stored in Google Drive.
 * New writes use Capsule v1; legacy index reads are handled inside Capsule.
 */

import type { JsonValue } from "@zerodrivehq/capsule";
import {
  createVaultIndexCapsule,
  openVaultIndexCapsule,
  openVaultIndexCapsuleWithRecoveryPhraseOnly,
} from "./capsuleAdapter";
import logger from "./logger";

/**
 * Encrypts metadata JSON with the active recovery phrase.
 * @param metadata The metadata object to encrypt
 * @returns Promise<Blob> The Capsule v1 encrypted metadata.
 */
export async function encryptMetadata(
  metadata: JsonValue,
  recoveryPhrase?: string,
): Promise<Blob> {
  try {
    const { encryptedBlob } = await createVaultIndexCapsule(
      metadata,
      recoveryPhrase,
    );
    return encryptedBlob;
  } catch (error) {
    logger.error("Error encrypting metadata:", error);
    throw error;
  }
}

/**
 * Decrypts a Capsule v1 or legacy encrypted vault index.
 * @param encryptedBlob The encrypted metadata Blob.
 * @returns Promise<any> The decrypted metadata object
 */
export async function decryptMetadata(encryptedBlob: Blob): Promise<any> {
  try {
    const { index } = await openVaultIndexCapsule(encryptedBlob);
    return index;
  } catch (error: unknown) {
    logger.error("Error decrypting metadata:", error);
    throw error;
  }
}

export async function decryptMetadataWithRecoveryPhrase(
  encryptedBlob: Blob,
  recoveryPhrase: string,
): Promise<any> {
  try {
    const { index } = await openVaultIndexCapsuleWithRecoveryPhraseOnly(
      encryptedBlob,
      recoveryPhrase,
    );
    return index;
  } catch (error: unknown) {
    logger.error("Error decrypting metadata with recovery phrase:", error);
    throw error;
  }
}
