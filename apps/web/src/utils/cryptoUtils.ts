import {
  generateRecoveryPhrase,
} from "@zerodrivehq/capsule";

export const VAULT_KEY_STORAGE_EVENT = "zerodrive-vault-key-storage-changed";

const notifyVaultKeyStorageChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VAULT_KEY_STORAGE_EVENT));
};

/**
 * Keep the derived legacy AES key in sessionStorage for historical ZeroDrive
 * objects. Capsule v1 writes use the active tab-session recovery phrase.
 */
export const storeKey = async (key: CryptoKey) => {
  // Export the encryption key to JWK format
  const keyJWK = await crypto.subtle.exportKey("jwk", key);

  // Store plain JWK in sessionStorage
  sessionStorage.setItem("aes-key", JSON.stringify(keyJWK));
  notifyVaultKeyStorageChanged();
};

/**
 * Retrieve encryption key from sessionStorage
 */
export const getStoredKey = async (): Promise<CryptoKey | null> => {
  const storedData = sessionStorage.getItem("aes-key");
  if (!storedData) return null;

  try {
    // Parse and import the JWK
    const keyJWK = JSON.parse(storedData);
    return await crypto.subtle.importKey(
      "jwk",
      keyJWK,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    console.error("Failed to load stored key:", error);
    return null;
  }
};

export const clearStoredKey = () => {
  sessionStorage.removeItem("aes-key");
  notifyVaultKeyStorageChanged();
};

export const generateMnemonic = (): string => {
  return generateRecoveryPhrase();
};
