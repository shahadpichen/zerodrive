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

export const storeKey = async (key: CryptoKey) => {
  const keyJWK = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem("aes-gcm-key", JSON.stringify(keyJWK));
};

export const getStoredKey = async (): Promise<CryptoKey | null> => {
  const keyJWK = localStorage.getItem("aes-gcm-key");
  if (!keyJWK) return null;
  return crypto.subtle.importKey(
    "jwk",
    JSON.parse(keyJWK),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
};

export const clearStoredKey = () => {
  localStorage.removeItem("aes-gcm-key");
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
