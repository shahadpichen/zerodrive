import * as bip39 from "bip39";

export const generateKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
};

/**
 * Store encryption key in sessionStorage (unencrypted)
 * SessionStorage is cleared when tab closes, providing adequate security
 */
export const storeKey = async (key: CryptoKey) => {
  // Export the encryption key to JWK format
  const keyJWK = await crypto.subtle.exportKey("jwk", key);

  // Store plain JWK in sessionStorage
  sessionStorage.setItem("aes-key", JSON.stringify(keyJWK));
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
};

export const generateMnemonic = (): string => {
  return bip39.generateMnemonic(128);
};

export const deriveKeyFromMnemonic = async (
  mnemonic: string
): Promise<CryptoKey> => {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const keyMaterial = await crypto.subtle.digest("SHA-256", seed);

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
};
