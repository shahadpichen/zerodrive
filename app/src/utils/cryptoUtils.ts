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
 * This key is used to encrypt encryption keys (AES and RSA) before storing
 */
export const deriveWrappingKeyFromMnemonic = async (
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

  // Get salt from environment variable
  // This must be stable across all deployments - changing it breaks key decryption!
  const saltString = process.env.REACT_APP_PBKDF2_SALT;
  if (!saltString) {
    throw new Error(
      "PBKDF2 salt not configured. Please set REACT_APP_PBKDF2_SALT in your .env file. " +
      "Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const salt = encoder.encode(saltString);

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

/**
 * Encrypt RSA private key JWK using mnemonic-derived wrapping key
 * If mnemonic not provided, gets it from memory cache
 */
export const encryptPrivateKeyJwk = async (
  privateKeyJwk: JsonWebKey,
  mnemonic?: string
): Promise<{ iv: number[]; encryptedKey: number[] }> => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    throw new Error(
      "No mnemonic available. Please enter your mnemonic first."
    );
  }

  // Convert JWK to bytes
  const keyData = new TextEncoder().encode(JSON.stringify(privateKeyJwk));

  // Derive wrapping key from mnemonic
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

  // Generate random IV for encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the private key data
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    wrappingKey,
    keyData
  );

  // Return IV + encrypted key
  return {
    iv: Array.from(iv),
    encryptedKey: Array.from(new Uint8Array(encryptedKey)),
  };
};

/**
 * Decrypt RSA private key JWK using mnemonic-derived wrapping key
 * If mnemonic not provided, gets it from memory cache
 */
export const decryptPrivateKeyJwk = async (
  encryptedData: { iv: number[]; encryptedKey: number[] },
  mnemonic?: string
): Promise<JsonWebKey> => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    throw new Error(
      "No mnemonic available. Please enter your mnemonic first."
    );
  }

  // Derive wrapping key from mnemonic
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

  // Decrypt the key data
  const decryptedKeyData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
    wrappingKey,
    new Uint8Array(encryptedData.encryptedKey)
  );

  // Parse and return the decrypted JWK
  return JSON.parse(new TextDecoder().decode(decryptedKeyData));
};

/**
 * Encrypt Google OAuth tokens using mnemonic-derived wrapping key
 * If mnemonic not provided, gets it from memory cache
 */
export const encryptGoogleTokens = async (
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    scope: string;
  },
  mnemonic?: string
): Promise<{ iv: number[]; encryptedTokens: number[] }> => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    throw new Error(
      "No mnemonic available. Please enter your mnemonic first."
    );
  }

  // Convert tokens to bytes
  const tokenData = new TextEncoder().encode(JSON.stringify(tokens));

  // Derive wrapping key from mnemonic
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

  // Generate random IV for encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the token data
  const encryptedTokens = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    wrappingKey,
    tokenData
  );

  // Return IV + encrypted tokens
  return {
    iv: Array.from(iv),
    encryptedTokens: Array.from(new Uint8Array(encryptedTokens)),
  };
};

/**
 * Decrypt Google OAuth tokens using mnemonic-derived wrapping key
 * If mnemonic not provided, gets it from memory cache
 */
export const decryptGoogleTokens = async (
  encryptedData: { iv: number[]; encryptedTokens: number[] },
  mnemonic?: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}> => {
  // Get mnemonic from cache if not provided
  const mnemonicToUse = mnemonic || getMnemonic();
  if (!mnemonicToUse) {
    throw new Error(
      "No mnemonic available. Please enter your mnemonic first."
    );
  }

  // Derive wrapping key from mnemonic
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonicToUse);

  // Decrypt the token data
  const decryptedTokenData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
    wrappingKey,
    new Uint8Array(encryptedData.encryptedTokens)
  );

  // Parse and return the decrypted tokens
  const tokens = JSON.parse(new TextDecoder().decode(decryptedTokenData));

  // Convert expiresAt back to Date object
  return {
    ...tokens,
    expiresAt: new Date(tokens.expiresAt),
  };
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
