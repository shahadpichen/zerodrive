/**
 * KeyStorage utility for securely managing cryptographic keys
 * Stores keys in IndexedDB associated with specific user accounts
 */

import { openDB, IDBPDatabase } from "idb";
import { UserKeyPair } from "./fileSharing";

const DB_NAME = "zerodrive-keys";
const DB_VERSION = 1;
const KEY_STORE = "user-keys";

interface UserKeyData {
  email: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: number;
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
      },
    });
  }
  return dbPromise;
};

/**
 * Store a user's key pair in IndexedDB
 * @param email The user's email to associate with the keys
 * @param keyPair The key pair to store
 */
export async function storeUserKeyPair(
  email: string,
  keyPair: { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }
): Promise<void> {
  if (!email) throw new Error("User email is required");
  if (!keyPair?.publicKeyJwk || !keyPair?.privateKeyJwk) {
    throw new Error("Complete key pair is required");
  }

  const db = await getDb();
  const userData: UserKeyData = {
    email,
    publicKeyJwk: keyPair.publicKeyJwk,
    privateKeyJwk: keyPair.privateKeyJwk,
    createdAt: Date.now(),
  };

  await db.put(KEY_STORE, userData);
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
    console.error("Error checking for user keys:", error);
    return false;
  }
}

/**
 * Get a user's key pair from IndexedDB
 * @param email The user's email
 * @returns The user's key pair or null if not found
 */
export async function getUserKeyPair(
  email: string
): Promise<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey } | null> {
  if (!email) return null;

  try {
    const db = await getDb();
    const userData = await db.get(KEY_STORE, email);

    if (!userData) return null;

    return {
      publicKeyJwk: userData.publicKeyJwk,
      privateKeyJwk: userData.privateKeyJwk,
    };
  } catch (error) {
    console.error("Error retrieving user keys:", error);
    return null;
  }
}

/**
 * Delete a user's key pair from IndexedDB
 * @param email The user's email
 */
export async function deleteUserKeyPair(email: string): Promise<void> {
  if (!email) return;

  const db = await getDb();
  await db.delete(KEY_STORE, email);
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
  email: string
): Promise<string | null> => {
  const keyPair = await getUserKeyPair(email);
  if (!keyPair) return null;

  return JSON.stringify(keyPair.privateKeyJwk);
};

/**
 * Clear all keys from the database (mostly for testing/debugging)
 */
export const clearAllKeys = async (): Promise<void> => {
  const db = await getDb();
  await db.clear(KEY_STORE);
};
