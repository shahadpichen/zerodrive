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

/**
 * Derive a wrapping key from mnemonic phrase using PBKDF2
 * Used to encrypt RSA private keys stored in IndexedDB
 */
export const deriveWrappingKeyFromMnemonic = async (
  mnemonic: string
): Promise<CryptoKey> => {
  const salt = process.env.REACT_APP_RSA_PBKDF2_SALT || 'default-rsa-salt';
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(mnemonic),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt RSA private key JWK with mnemonic-derived key
 */
export const encryptRsaPrivateKey = async (
  privateKeyJwk: JsonWebKey,
  mnemonic: string
): Promise<string> => {
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonic);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encoder.encode(JSON.stringify(privateKeyJwk))
  );

  // Combine iv + encrypted data, return as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...Array.from(combined)));
};

/**
 * Decrypt RSA private key JWK with mnemonic-derived key
 */
export const decryptRsaPrivateKey = async (
  encryptedData: string,
  mnemonic: string
): Promise<JsonWebKey> => {
  const wrappingKey = await deriveWrappingKeyFromMnemonic(mnemonic);

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encrypted
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
};
