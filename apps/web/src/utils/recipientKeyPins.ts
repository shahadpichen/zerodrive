const STORAGE_KEY = "zerodrive-recipient-key-pins-v2";
const LEGACY_STORAGE_KEY_PREFIX = "zerodrive-recipient-key-pins-v1:";

export interface RecipientKeyPin {
  fingerprint: string;
  keyVersion: number;
  pinnedAt: number;
}

type RecipientKeyPins = Record<string, RecipientKeyPin>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRecipientKeyPin(value: unknown): value is RecipientKeyPin {
  if (!value || typeof value !== "object") return false;
  const pin = value as Partial<RecipientKeyPin>;
  return (
    typeof pin.fingerprint === "string" &&
    /^[0-9a-f]{64}$/.test(pin.fingerprint) &&
    typeof pin.keyVersion === "number" &&
    Number.isInteger(pin.keyVersion) &&
    pin.keyVersion > 0 &&
    typeof pin.pinnedAt === "number" &&
    Number.isFinite(pin.pinnedAt)
  );
}

function parsePins(value: string | null): RecipientKeyPins {
  if (!value) return {};
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, RecipientKeyPin] =>
      isRecipientKeyPin(entry[1]),
    ),
  );
}

/**
 * Version 1 scoped pins with an API-supplied account lookup identifier. That
 * allowed a changed API response to select an empty namespace and silently
 * reset trust-on-first-use. Version 2 uses one browser-local trust ledger.
 *
 * During migration, keep the oldest observation when legacy account ledgers
 * disagree. A newer (potentially attacker-injected) pin must not silently
 * replace the browser's first trust decision.
 */
function migrateLegacyPins(): RecipientKeyPins {
  const migrated: RecipientKeyPins = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(LEGACY_STORAGE_KEY_PREFIX)) continue;

    try {
      const legacyPins = parsePins(localStorage.getItem(key));
      Object.entries(legacyPins).forEach(([email, pin]) => {
        const normalizedEmail = normalizeEmail(email);
        const existing = migrated[normalizedEmail];
        if (!existing || pin.pinnedAt < existing.pinnedAt) {
          migrated[normalizedEmail] = pin;
        }
      });
    } catch {
      // Ignore malformed legacy storage and keep migrating valid ledgers.
    }
  }

  if (Object.keys(migrated).length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

function readPins(): RecipientKeyPins {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    return current ? parsePins(current) : migrateLegacyPins();
  } catch {
    return {};
  }
}

export function getRecipientKeyPin(
  email: string,
): RecipientKeyPin | null {
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
