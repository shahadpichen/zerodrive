/**
 * RSA Key Recovery Utility
 * Centralized logic for recovering RSA keys from Google Drive backups
 */

import { toast } from 'sonner';
import { downloadEncryptedRsaKeyFromDrive } from './gdriveKeyStorage';
import { decryptRsaPrivateKeyWithAesKey } from './rsaKeyManager';
import { getStoredKey } from './cryptoUtils';
import { userHasStoredKeys, storeUserKeyPair } from './keyStorage';
import { storeUserPublicKey, hashEmail, UserKeyPair } from './fileSharing';
import logger from './logger';

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
  silent: boolean = false
): Promise<RsaRecoveryResult> {
  if (!userEmail) {
    logger.warn('[RSA Recovery] No user email provided');
    return {
      success: false,
      recovered: false,
      keysExisted: false,
      error: 'No user email provided',
    };
  }

  try {
    // Check if keys already exist in IndexedDB
    const keysExist = await userHasStoredKeys(userEmail);

    if (keysExist) {
      logger.log('[RSA Recovery] Keys already exist in IndexedDB, skipping recovery');
      return {
        success: true,
        recovered: false,
        keysExisted: true,
      };
    }

    // Keys don't exist - attempt recovery from Google Drive
    if (!silent) {
      logger.log('[RSA Recovery] Keys not found in IndexedDB, attempting recovery from Google Drive...');
    }

    const toastId = silent ? undefined : toast.loading('Checking for RSA key backup in Google Drive...');

    let encryptedKeyBlob: Blob | null = null;

    try {
      encryptedKeyBlob = await downloadEncryptedRsaKeyFromDrive();
    } catch (downloadError: any) {
      // Backup might not exist (e.g., new user who hasn't enabled sharing yet)
      if (downloadError.message?.includes('not found')) {
        logger.log('[RSA Recovery] No backup found in Google Drive (user may not have enabled sharing yet)');
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
      logger.log('[RSA Recovery] No backup found in Google Drive');
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
      toast.loading('Backup found. Decrypting with your primary key...', { id: toastId });
    }

    const primaryAesKey = await getStoredKey();

    if (!primaryAesKey) {
      const errorMsg = 'Primary encryption key not found in session storage';
      logger.error('[RSA Recovery]', errorMsg);

      if (toastId && !silent) {
        toast.error('Cannot decrypt RSA key backup', {
          description: 'Primary encryption key not found. Please enter your mnemonic in Key Management.',
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
      // Decrypt the private key
      const privateKeyJwk = await decryptRsaPrivateKeyWithAesKey(
        encryptedKeyBlob,
        primaryAesKey
      );

      // Construct public key from private key
      // RSA private JWK contains public components (n, e)
      const publicKeyJwk: JsonWebKey = {
        kty: privateKeyJwk.kty,
        n: privateKeyJwk.n,
        e: privateKeyJwk.e,
        alg: privateKeyJwk.alg?.replace('PS', 'RS') || 'RSA-OAEP-256',
        key_ops: ['encrypt'],
        ext: true,
      };

      // Validate essential components
      if (!publicKeyJwk.n || !publicKeyJwk.e || !publicKeyJwk.kty) {
        throw new Error('Failed to reconstruct public key from private key backup');
      }

      // Ensure private key has correct key_ops
      if (!privateKeyJwk.key_ops) {
        privateKeyJwk.key_ops = ['decrypt'];
      }

      const recoveredKeyPair: UserKeyPair = {
        publicKeyJwk,
        privateKeyJwk,
      };

      // Store in IndexedDB
      await storeUserKeyPair(userEmail, recoveredKeyPair);

      // Store public key in PostgreSQL
      const hashedEmail = await hashEmail(userEmail);
      await storeUserPublicKey(hashedEmail, recoveredKeyPair.publicKeyJwk);

      logger.log('[RSA Recovery] Successfully recovered and stored RSA keys from Google Drive');

      if (toastId && !silent) {
        toast.success('RSA keys recovered from Google Drive', {
          description: 'Your sharing keys have been restored successfully.',
          id: toastId,
        });
      }

      return {
        success: true,
        recovered: true,
        keysExisted: false,
      };
    } catch (decryptionError: any) {
      logger.error('[RSA Recovery] Failed to decrypt key backup:', decryptionError);

      if (toastId && !silent) {
        toast.error('Failed to decrypt RSA key backup', {
          description: decryptionError.message || 'The primary key might be incorrect or backup corrupted.',
          id: toastId,
          duration: 7000,
        });
      }

      return {
        success: false,
        recovered: false,
        keysExisted: false,
        error: decryptionError.message || 'Decryption failed',
      };
    }
  } catch (error: any) {
    logger.error('[RSA Recovery] Unexpected error during recovery:', error);

    if (!silent) {
      toast.error('Failed to recover RSA keys', {
        description: error.message || 'An unexpected error occurred',
        duration: 5000,
      });
    }

    return {
      success: false,
      recovered: false,
      keysExisted: false,
      error: error.message || 'Unexpected error',
    };
  }
}
