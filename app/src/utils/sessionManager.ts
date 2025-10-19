/**
 * Session Manager
 * Handles session lifecycle, recovery, and account switching
 */

import { gapi } from "gapi-script";
import { storeKey, getStoredKey } from "./cryptoUtils";
import { getUserKeyPair, userHasStoredKeys } from "./keyStorage";
import { downloadEncryptedRsaKeyFromDrive } from "./gdriveKeyStorage";
import { decryptRsaPrivateKeyWithAesKey } from "./rsaKeyManager";
import { hashEmail, storeUserPublicKey } from "./fileSharing";

interface SessionRecoveryResult {
  success: boolean;
  message: string;
  userEmail?: string;
  hasKeys: boolean;
}

/**
 * Get the current user's email from Google Auth
 */
export const getCurrentUserEmail = (): string | null => {
  try {
    const authInstance = gapi.auth2?.getAuthInstance();
    if (authInstance && authInstance.isSignedIn.get()) {
      const profile = authInstance.currentUser.get().getBasicProfile();
      return profile?.getEmail() || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting current user email:", error);
    return null;
  }
};

/**
 * Store the current session's user email
 */
export const setSessionUser = (email: string): void => {
  sessionStorage.setItem("session-user-email", email);
};

/**
 * Get the session's stored user email
 */
export const getSessionUser = (): string | null => {
  return sessionStorage.getItem("session-user-email");
};

/**
 * Check if the current Google user matches the session user
 * Returns true if they match, false if different user detected
 */
export const isSessionUserValid = (): boolean => {
  const currentEmail = getCurrentUserEmail();
  const sessionEmail = getSessionUser();

  if (!currentEmail || !sessionEmail) {
    return false;
  }

  return currentEmail === sessionEmail;
};

/**
 * Clear all session data
 */
export const clearSession = (): void => {
  sessionStorage.clear();
};

/**
 * Attempt to recover the AES key from Google Drive backup
 * This is used when sessionStorage is empty (e.g., after page refresh or new tab)
 */
export const recoverAesKeyFromBackup = async (userEmail: string): Promise<boolean> => {
  try {
    console.log("Attempting to recover AES key from Google Drive backup...");

    // Check if key already exists in sessionStorage
    const existingKey = await getStoredKey();
    if (existingKey) {
      console.log("AES key already exists in sessionStorage");
      return true;
    }

    // Try to download encrypted RSA key from Google Drive
    const encryptedKeyBlob = await downloadEncryptedRsaKeyFromDrive();

    if (!encryptedKeyBlob) {
      console.log("No backup found in Google Drive");
      return false;
    }

    console.log("Backup found in Google Drive, but cannot decrypt without primary AES key");
    console.log("User will need to re-enter their recovery phrase or generate new keys");
    return false;

  } catch (error) {
    console.error("Error during AES key recovery:", error);
    return false;
  }
};

/**
 * Initialize or restore the user's session
 * This should be called on app startup and after authentication
 */
export const initializeSession = async (): Promise<SessionRecoveryResult> => {
  try {
    const currentEmail = getCurrentUserEmail();

    if (!currentEmail) {
      return {
        success: false,
        message: "No authenticated user found",
        hasKeys: false,
      };
    }

    // Check for account switching
    const sessionEmail = getSessionUser();
    if (sessionEmail && sessionEmail !== currentEmail) {
      console.warn(`Account switch detected: ${sessionEmail} -> ${currentEmail}`);
      clearSession();
      sessionStorage.setItem("isAuthenticated", "true");
    }

    // Store current user in session
    setSessionUser(currentEmail);

    // Check if AES key exists in sessionStorage
    const hasAesKey = !!(await getStoredKey());

    // Check if RSA keys exist in IndexedDB
    const hasRsaKeys = await userHasStoredKeys(currentEmail);

    console.log("Session status:", {
      email: currentEmail,
      hasAesKey,
      hasRsaKeys,
    });

    return {
      success: true,
      message: hasAesKey ? "Session restored" : "Session initialized (no AES key)",
      userEmail: currentEmail,
      hasKeys: hasAesKey && hasRsaKeys,
    };

  } catch (error) {
    console.error("Error initializing session:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      hasKeys: false,
    };
  }
};

/**
 * Handle account switch - clear previous session and initialize new one
 */
export const handleAccountSwitch = async (): Promise<void> => {
  console.log("Handling account switch...");
  clearSession();

  // Re-authenticate
  sessionStorage.setItem("isAuthenticated", "true");

  // Initialize new session
  await initializeSession();
};

/**
 * Auto-repair: Sync public key to server if missing
 */
export const autoSyncPublicKey = async (userEmail: string): Promise<boolean> => {
  try {
    const { fetchUserPublicKey } = await import("./fileSharing");
    const hashedEmail = await hashEmail(userEmail);

    // Check if public key exists on server
    const serverKey = await fetchUserPublicKey(hashedEmail);

    if (!serverKey) {
      console.log("Public key missing from server, attempting auto-sync...");

      // Get key from IndexedDB
      const localKeyPair = await getUserKeyPair(userEmail);

      if (localKeyPair?.publicKeyJwk) {
        await storeUserPublicKey(hashedEmail, localKeyPair.publicKeyJwk);
        console.log("Public key synced to server successfully");
        return true;
      } else {
        console.warn("No local key pair found for auto-sync");
        return false;
      }
    }

    return true; // Key already exists on server
  } catch (error) {
    console.error("Error during auto-sync:", error);
    return false;
  }
};
