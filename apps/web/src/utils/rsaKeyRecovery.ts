/**
 * RSA Key Recovery Utility
 * Centralized logic for recovering RSA keys from Google Drive backups
 */

import { toast } from "sonner";
import { downloadEncryptedRsaKeyFromDrive } from "./gdriveKeyStorage";
import { userHasStoredKeys, storeUserKeyPair } from "./keyStorage";
import { fetchRecipientPublicKey, UserKeyPair } from "./fileSharing";
import { getMnemonic } from "./mnemonicManager";
import {
  fingerprintSharingPublicKey,
  openSharingKeyBackupCapsule,
} from "./capsuleAdapter";
import logger from "./logger";

function publicKeyFromPrivate(privateKeyJwk: JsonWebKey): JsonWebKey {
  const publicKeyJwk: JsonWebKey = {
    kty: privateKeyJwk.kty,
    n: privateKeyJwk.n,
    e: privateKeyJwk.e,
    alg: "RSA-OAEP-256",
    key_ops: ["encrypt"],
    ext: true,
  };
  if (!publicKeyJwk.n || !publicKeyJwk.e || !publicKeyJwk.kty) {
    throw new Error("Failed to reconstruct public key from private key backup");
  }
  return publicKeyJwk;
}

export async function recoverRsaKeyVersion(
  userEmail: string,
  keyVersion: number,
  mnemonic: string,
  expectedFingerprint?: string,
): Promise<UserKeyPair | null> {
  try {
    const encrypted = await downloadEncryptedRsaKeyFromDrive(keyVersion);
    const opened = await openSharingKeyBackupCapsule(
      encrypted,
      mnemonic,
      { legacyKeyVersion: keyVersion },
    );
    if (opened.keyVersion !== undefined && opened.keyVersion !== keyVersion) {
      throw new Error("Sharing-key backup version does not match the share");
    }
    const privateKeyJwk = opened.privateKeyJwk as JsonWebKey;
    privateKeyJwk.key_ops = ["decrypt"];
    const keyPair: UserKeyPair = {
      publicKeyJwk:
        (opened.publicKeyJwk as JsonWebKey | undefined) ||
        publicKeyFromPrivate(privateKeyJwk),
      privateKeyJwk,
    };
    const fingerprint = await fingerprintSharingPublicKey(
      keyPair.publicKeyJwk,
    );
    if (
      (opened.fingerprint && opened.fingerprint !== fingerprint) ||
      (expectedFingerprint && expectedFingerprint !== fingerprint)
    ) {
      throw new Error("Sharing-key backup fingerprint does not match the share");
    }
    await storeUserKeyPair(userEmail, keyPair, mnemonic, keyVersion, {
      makeCurrent: false,
    });
    return keyPair;
  } catch (error) {
    logger.warn(`[RSA Recovery] Key version ${keyVersion} unavailable`, error);
    return null;
  }
}

export interface RsaRecoveryResult {
  success: boolean;
  recovered: boolean;
  keysExisted: boolean;
  error?: string;
}

/**
 * Attempt to recover RSA keys from Google Drive backup if not present in IndexedDB
 * @param userEmail User's email address
 * @param silent If true, suppresses toast notifications (for background recovery)
 * @returns Recovery result with status information
 */
export async function recoverRsaKeysIfNeeded(
  userEmail: string,
  silent: boolean = false,
): Promise<RsaRecoveryResult> {
  if (!userEmail) {
    logger.warn("[RSA Recovery] No user email provided");
    return {
      success: false,
      recovered: false,
      keysExisted: false,
      error: "No user email provided",
    };
  }

  try {
    // Check if keys already exist in IndexedDB
    const keysExist = await userHasStoredKeys(userEmail);

    if (keysExist) {
      logger.log(
        "[RSA Recovery] Keys already exist in IndexedDB, skipping recovery",
      );
      return {
        success: true,
        recovered: false,
        keysExisted: true,
      };
    }

    // Keys don't exist - attempt recovery from Google Drive
    if (!silent) {
      logger.log(
        "[RSA Recovery] Keys not found in IndexedDB, attempting recovery from Google Drive...",
      );
    }

    const toastId = silent
      ? undefined
      : toast.loading("Checking for RSA key backup in Google Drive...");

    let encryptedKeyBlob: Blob | null = null;

    try {
      encryptedKeyBlob = await downloadEncryptedRsaKeyFromDrive();
    } catch (downloadError: any) {
      // Backup might not exist (e.g., new user who hasn't enabled sharing yet)
      if (downloadError.message?.includes("not found")) {
        logger.log(
          "[RSA Recovery] No backup found in Google Drive (user may not have enabled sharing yet)",
        );
        if (toastId && !silent) {
          toast.dismiss(toastId);
        }
        return {
          success: true,
          recovered: false,
          keysExisted: false,
        };
      }

      // Other download errors
      throw downloadError;
    }

    if (!encryptedKeyBlob) {
      logger.log("[RSA Recovery] No backup found in Google Drive");
      if (toastId && !silent) {
        toast.dismiss(toastId);
      }
      return {
        success: true,
        recovered: false,
        keysExisted: false,
      };
    }

    // Backup found - attempt decryption
    if (toastId && !silent) {
      toast.loading("Backup found. Decrypting with your primary key...", {
        id: toastId,
      });
    }

    const mnemonic = getMnemonic();
    if (!mnemonic) {
      const errorMsg = "Recovery phrase is not active in this browser tab";
      logger.error("[RSA Recovery]", errorMsg);

      if (toastId && !silent) {
        toast.error("Cannot decrypt RSA key backup", {
          description: "Enter your recovery phrase in Recovery & Access.",
          id: toastId,
          duration: 7000,
        });
      }

      return {
        success: false,
        recovered: false,
        keysExisted: false,
        error: errorMsg,
      };
    }

    try {
      const activeDirectoryKey = await fetchRecipientPublicKey(userEmail);
      if (!activeDirectoryKey) {
        throw new Error(
          "The backup cannot be activated because no current sharing identity exists.",
        );
      }

      const opened = await openSharingKeyBackupCapsule(
        encryptedKeyBlob,
        mnemonic,
        { legacyKeyVersion: activeDirectoryKey.key_version },
      );
      const privateKeyJwk = opened.privateKeyJwk as JsonWebKey;

      const publicKeyJwk =
        (opened.publicKeyJwk as JsonWebKey | undefined) ||
        publicKeyFromPrivate(privateKeyJwk);

      // Ensure private key has correct key_ops
      if (!privateKeyJwk.key_ops) {
        privateKeyJwk.key_ops = ["decrypt"];
      }

      const recoveredKeyPair: UserKeyPair = {
        publicKeyJwk,
        privateKeyJwk,
      };

      const fingerprint = await fingerprintSharingPublicKey(
        recoveredKeyPair.publicKeyJwk,
      );
      if (
        opened.keyVersion !== activeDirectoryKey.key_version ||
        opened.fingerprint !== fingerprint ||
        fingerprint !== activeDirectoryKey.fingerprint
      ) {
        throw new Error(
          "The backup does not match the current sharing identity. Create or rotate the identity explicitly.",
        );
      }

      await storeUserKeyPair(
        userEmail,
        recoveredKeyPair,
        mnemonic,
        activeDirectoryKey.key_version,
      );

      logger.log(
        "[RSA Recovery] Successfully recovered and stored RSA keys from Google Drive",
      );

      if (toastId && !silent) {
        toast.success("RSA keys recovered from Google Drive", {
          description: "Your sharing keys have been restored successfully.",
          id: toastId,
        });
      }

      return {
        success: true,
        recovered: true,
        keysExisted: false,
      };
    } catch (decryptionError: any) {
      logger.error(
        "[RSA Recovery] Failed to decrypt key backup:",
        decryptionError,
      );

      if (toastId && !silent) {
        toast.error("Failed to decrypt RSA key backup", {
          description:
            decryptionError.message ||
            "The primary key might be incorrect or backup corrupted.",
          id: toastId,
          duration: 7000,
        });
      }

      return {
        success: false,
        recovered: false,
        keysExisted: false,
        error: decryptionError.message || "Decryption failed",
      };
    }
  } catch (error: any) {
    logger.error("[RSA Recovery] Unexpected error during recovery:", error);

    if (!silent) {
      toast.error("Failed to recover RSA keys", {
        description: error.message || "An unexpected error occurred",
        duration: 5000,
      });
    }

    return {
      success: false,
      recovered: false,
      keysExisted: false,
      error: error.message || "Unexpected error",
    };
  }
}
