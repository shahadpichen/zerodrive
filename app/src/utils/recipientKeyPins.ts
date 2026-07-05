const STORAGE_KEY_PREFIX = "zerodrive-recipient-key-pins-v1";

export interface RecipientKeyPin {
  fingerprint: string;
  keyVersion: number;
  pinnedAt: number;
}

type RecipientKeyPins = Record<string, RecipientKeyPin>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function storageKey(ownerLookupId: string): string {
  if (!/^[0-9a-f]{64}$/.test(ownerLookupId)) {
    throw new Error("Invalid key-pin owner");
  }
  return `${STORAGE_KEY_PREFIX}:${ownerLookupId}`;
}

function readPins(ownerLookupId: string): RecipientKeyPins {
  try {
    const value = localStorage.getItem(storageKey(ownerLookupId));
    return value ? (JSON.parse(value) as RecipientKeyPins) : {};
  } catch {
    return {};
  }
}

export function getRecipientKeyPin(
  ownerLookupId: string,
  email: string,
): RecipientKeyPin | null {
  return readPins(ownerLookupId)[normalizeEmail(email)] || null;
}

export function pinRecipientKey(
  ownerLookupId: string,
  email: string,
  fingerprint: string,
  keyVersion: number,
): void {
  if (!/^[0-9a-f]{64}$/.test(fingerprint) || keyVersion < 1) {
    throw new Error("Cannot pin an invalid recipient key");
  }
  const pins = readPins(ownerLookupId);
  pins[normalizeEmail(email)] = {
    fingerprint,
    keyVersion,
    pinnedAt: Date.now(),
  };
  localStorage.setItem(storageKey(ownerLookupId), JSON.stringify(pins));
}
