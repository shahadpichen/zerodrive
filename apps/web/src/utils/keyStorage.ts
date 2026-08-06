/**
 * Account-scoped sharing-key storage.
 *
 * Private keys are stored as Capsule sharing-key backups. Historical
 * PBKDF2-encrypted records are opened only through Capsule's legacy reader.
 */

import { openDB, IDBPDatabase } from "idb";
import {
  base64ToBytes,
  blobToBytes,
  bytesToBase64,
  bytesToBlob,
  createSharingKeyBackupCapsule,
  fingerprintSharingPublicKey,
  openSharingKeyBackupCapsule,
} from "./capsuleAdapter";
import logger from "./logger";

const DB_NAME = "zerodrive-keys";
const DB_VERSION = 3;
const KEY_STORE = "user-keys";
const VERSIONED_KEY_STORE = "versioned-user-keys";

interface UserKeyData {
  email: string;
  publicKeyJwk: JsonWebKey;
  encryptedPrivateKey: string; // Base64-encoded Capsule or legacy backup bytes
  createdAt: number;
  keyVersion?: number;
}

export interface StoredUserKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  keyVersion?: number;
  fingerprint: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

// Initialize the database
const getDb = async (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create the object store if it doesn't exist
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          const store = db.createObjectStore(KEY_STORE, { keyPath: "email" });
          store.createIndex("email", "email", { unique: true });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(VERSIONED_KEY_STORE)) {
          const store = db.createObjectStore(VERSIONED_KEY_STORE, {
            keyPath: ["email", "keyVersion"],
          });
          store.createIndex("email", "email", { unique: false });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Store a user's key pair in IndexedDB
 * @param email The user's email to associate with the keys
 * @param keyPair The key pair to store
 * @param mnemonic The mnemonic to encrypt the private key
 */
export async function storeUserKeyPair(
  email: string,
  keyPair: { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey },
  mnemonic: string,
  keyVersion: number = 1,
  options: { makeCurrent?: boolean } = {},
): Promise<void> {
  if (!email) throw new Error("User email is required");
  if (!keyPair?.publicKeyJwk || !keyPair?.privateKeyJwk) {
    throw new Error("Complete key pair is required");
  }
  if (!mnemonic) throw new Error("Mnemonic is required to encrypt private key");

  const fingerprint = await fingerprintSharingPublicKey(
    keyPair.publicKeyJwk,
  );
  const encryptedPrivateKeyBlob = await createSharingKeyBackupCapsule({
    privateKeyJwk: keyPair.privateKeyJwk,
    publicKeyJwk: keyPair.publicKeyJwk,
    recoveryPhrase: mnemonic,
    keyVersion,
    fingerprint,
  });
  const encryptedBytes = await blobToBytes(encryptedPrivateKeyBlob);
  let encryptedPrivateKey: string;
  try {
    encryptedPrivateKey = bytesToBase64(encryptedBytes);
  } finally {
    encryptedBytes.fill(0);
  }

  const db = await getDb();
  const userData: UserKeyData = {
    email,
    publicKeyJwk: keyPair.publicKeyJwk,
    encryptedPrivateKey,
    createdAt: Date.now(),
    keyVersion,
  };

  await db.put(VERSIONED_KEY_STORE, userData);
  if (options.makeCurrent !== false) {
    await db.put(KEY_STORE, userData);
  }
  logger.info("[KeyStorage] Sharing keys stored in a Capsule backup");
}

/**
 * Check if a user has stored keys
 * @param email The user's email
 * @returns True if keys exist for this user
 */
export async function userHasStoredKeys(email: string): Promise<boolean> {
  if (!email) return false;

  try {
    const db = await getDb();
    const keys = await db.get(KEY_STORE, email);
    return !!keys;
  } catch (error) {
    logger.error("Error checking for user keys:", error);
    return false;
  }
}

/**
 * Get a user's key pair from IndexedDB
 * @param email The user's email
 * @param mnemonic The mnemonic to decrypt the private key
 * @returns The user's key pair or null if not found
 */
export async function getUserKeyPair(
  email: string,
  mnemonic: string,
  keyVersion?: number,
): Promise<StoredUserKeyPair | null> {
  if (!email) return null;
  if (!mnemonic) throw new Error("Mnemonic is required to decrypt private key");

  try {
    const db = await getDb();
    const userData = keyVersion
      ? await db.get(VERSIONED_KEY_STORE, [email, keyVersion])
      : await db.get(KEY_STORE, email);

    if (!userData) return null;

    const opened = await openUserKeyData(userData, mnemonic, keyVersion);
    return opened;
  } catch (error) {
    logger.error("Error retrieving sharing keys:", error);
    throw error; // Propagate error so caller can handle wrong mnemonic
  }
}

async function openUserKeyData(
  userData: UserKeyData,
  mnemonic: string,
  fallbackKeyVersion?: number,
): Promise<StoredUserKeyPair> {
  if (!userData.encryptedPrivateKey) {
    throw new Error("No encrypted private key found in IndexedDB");
  }

  const encryptedBytes = base64ToBytes(userData.encryptedPrivateKey);
  try {
    const opened = await openSharingKeyBackupCapsule(
      bytesToBlob(encryptedBytes),
      mnemonic,
      {
        legacyPbkdf2Salt:
          process.env.REACT_APP_RSA_PBKDF2_SALT || "default-rsa-salt",
        legacyKeyVersion:
          userData.keyVersion || fallbackKeyVersion || 1,
      },
    );

    const expectedKeyVersion =
      userData.keyVersion || fallbackKeyVersion || opened.keyVersion || 1;
    if (
      opened.keyVersion !== undefined &&
      opened.keyVersion !== expectedKeyVersion
    ) {
      throw new Error("Sharing-key backup version does not match its record");
    }

    const publicKeyJwk =
      (opened.publicKeyJwk as JsonWebKey | undefined) || userData.publicKeyJwk;
    const [fingerprint, storedPublicKeyFingerprint] = await Promise.all([
      fingerprintSharingPublicKey(publicKeyJwk),
      fingerprintSharingPublicKey(userData.publicKeyJwk),
    ]);
    if (
      (opened.fingerprint && opened.fingerprint !== fingerprint) ||
      storedPublicKeyFingerprint !== fingerprint
    ) {
      throw new Error(
        "Sharing-key backup fingerprint does not match its record",
      );
    }

    return {
      publicKeyJwk,
      privateKeyJwk: opened.privateKeyJwk as JsonWebKey,
      keyVersion: expectedKeyVersion,
      fingerprint,
    };
  } finally {
    encryptedBytes.fill(0);
  }
}

/**
 * Open every locally retained sharing key for an account. Legacy shares may
 * not identify their recipient-key version, so Capsule needs all historical
 * private keys as candidates and performs the actual key match.
 */
export async function getUserKeyPairs(
  email: string,
  mnemonic: string,
): Promise<StoredUserKeyPair[]> {
  if (!email) return [];
  if (!mnemonic) throw new Error("Mnemonic is required to decrypt private keys");

  const db = await getDb();
  const [current, versioned] = await Promise.all([
    db.get(KEY_STORE, email) as Promise<UserKeyData | undefined>,
    db.getAllFromIndex(
      VERSIONED_KEY_STORE,
      "email",
      email,
    ) as Promise<UserKeyData[]>,
  ]);

  const records = [...versioned];
  if (
    current &&
    !records.some(
      (record) =>
        record.keyVersion === current.keyVersion &&
        JSON.stringify(record.publicKeyJwk) ===
          JSON.stringify(current.publicKeyJwk),
    )
  ) {
    records.push(current);
  }

  const opened = await Promise.all(
    records.map(async (record) => {
      try {
        return await openUserKeyData(record, mnemonic);
      } catch (error) {
        logger.warn(
          `[KeyStorage] Sharing key version ${record.keyVersion ?? "unknown"} could not be opened`,
          error,
        );
        return null;
      }
    }),
  );

  return opened.filter((key): key is StoredUserKeyPair => key !== null);
}

/**
 * Delete a user's key pair from IndexedDB
 * @param email The user's email
 */
export async function deleteUserKeyPair(email: string): Promise<void> {
  if (!email) return;

  const db = await getDb();
  await db.delete(KEY_STORE, email);
  const versionedKeys = await db.getAllFromIndex(
    VERSIONED_KEY_STORE,
    "email",
    email,
  );
  const transaction = db.transaction(VERSIONED_KEY_STORE, "readwrite");
  await Promise.all([
    ...versionedKeys.map((key) =>
      transaction.store.delete([email, key.keyVersion]),
    ),
    transaction.done,
  ]);
}

/**
 * List all users with stored keys
 * @returns Array of emails with stored keys
 */
export async function listUsersWithKeys(): Promise<string[]> {
  const db = await getDb();
  const allKeys = await db.getAll(KEY_STORE);
  return allKeys.map((keyData) => keyData.email);
}

/**
 * Export the private key as a string (for special cases)
 * @param email The user's email
 * @returns Promise resolving to the private key as a string or null if not found
 */
export const exportPrivateKeyAsString = async (
  email: string,
  mnemonic: string,
): Promise<string | null> => {
  const keyPair = await getUserKeyPair(email, mnemonic);
  if (!keyPair) return null;

  return JSON.stringify(keyPair.privateKeyJwk);
};

/**
 * Clear all keys from the database (mostly for testing/debugging)
 */
export const clearAllKeys = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(KEY_STORE);
  await db.clear(VERSIONED_KEY_STORE);
};
