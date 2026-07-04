const STORAGE_KEY = "zerodrive-recipient-key-pins-v1";

export interface RecipientKeyPin {
  fingerprint: string;
  keyVersion: number;
  pinnedAt: number;
}

type RecipientKeyPins = Record<string, RecipientKeyPin>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readPins(): RecipientKeyPins {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as RecipientKeyPins) : {};
  } catch {
    return {};
  }
}

export function getRecipientKeyPin(email: string): RecipientKeyPin | null {
  return readPins()[normalizeEmail(email)] || null;
}

export function pinRecipientKey(
  email: string,
  fingerprint: string,
  keyVersion: number,
): void {
  if (!/^[0-9a-f]{64}$/.test(fingerprint) || keyVersion < 1) {
    throw new Error("Cannot pin an invalid recipient key");
  }
  const pins = readPins();
  pins[normalizeEmail(email)] = {
    fingerprint,
    keyVersion,
    pinnedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}
