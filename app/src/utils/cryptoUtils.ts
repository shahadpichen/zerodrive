import * as bip39 from "bip39";
import { getMnemonic } from "./mnemonicManager";

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
 * Derive a wrapping key from mnemonic using PBKDF2
 * This key is used to encrypt the AES encryption key before storing in sessionStorage
 */
const deriveWrappingKeyFromMnemonic = async (
  mnemonic: string
): Promise<CryptoKey> => {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  // Convert mnemonic to bytes
  const encoder = new TextEncoder();
  const mnemonicBytes = encoder.encode(mnemonic);

  // Import as key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    mnemonicBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Use a fixed salt for deterministic key derivation
  // In production, you might want a per-user salt stored alongside encrypted data
  const salt = encoder.encode("zerodrive-key-wrapping-salt-v1");

  // Derive wrapping key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Store encryption key in sessionStorage (encrypted with mnemonic)
 * If mnemonic not provided, gets it from memory cache
 */
export const storeKey = async (key: CryptoKey, mnemonic?: string) => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    throw new Error(
      "No mnemonic available. Please enter your mnemonic first."
    );
  }

  // Export the encryption key to JWK format
  const keyJWK = await crypto.subtle.exportKey("jwk", key);
  const keyData = new TextEncoder().encode(JSON.stringify(keyJWK));

  // Derive wrapping key from mnemonic
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

  // Generate random IV for encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the key data
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    wrappingKey,
    keyData
  );

  // Store IV + encrypted key in sessionStorage
  const stored = {
    iv: Array.from(iv),
    encryptedKey: Array.from(new Uint8Array(encryptedKey)),
  };

  sessionStorage.setItem("aes-gcm-key", JSON.stringify(stored));
};

/**
 * Retrieve and decrypt encryption key from sessionStorage
 * If mnemonic not provided, gets it from memory cache
 */
export const getStoredKey = async (
  mnemonic?: string
): Promise<CryptoKey | null> => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    console.error("No mnemonic available. Please enter your mnemonic first.");
    return null;
  }

  const storedData = sessionStorage.getItem("aes-gcm-key");
  if (!storedData) return null;

  try {
    const { iv, encryptedKey } = JSON.parse(storedData);

    // Derive wrapping key from mnemonic
    const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

    // Decrypt the key data
    const decryptedKeyData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      wrappingKey,
      new Uint8Array(encryptedKey)
    );

    // Parse and import the decrypted JWK
    const keyJWK = JSON.parse(new TextDecoder().decode(decryptedKeyData));
    return crypto.subtle.importKey(
      "jwk",
      keyJWK,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    console.error("Failed to decrypt stored key:", error);
    return null;
  }
};

export const clearStoredKey = () => {
  sessionStorage.removeItem("aes-gcm-key");
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
