/**
 * Mnemonic Manager
 * Securely manages the recovery phrase for the current browser-tab session.
 *
 * The phrase is never sent to the backend. It is mirrored to sessionStorage so
 * a reload in the same tab does not lock the vault, and is cleared on logout,
 * account changes, or when the tab session ends.
 */

import { clearRememberedVaultMetadataStatuses } from "./vaultMetadataWriteGuard";

export const RECOVERY_PHRASE_MEMORY_EVENT =
  "zerodrive-recovery-phrase-memory-changed";

const RECOVERY_PHRASE_SESSION_KEY = "zerodrive-recovery-phrase-tab-session";

interface StoredRecoveryPhraseSession {
  version: 1;
  userEmail: string;
  phrase: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readCurrentSessionEmail(): string {
  if (typeof window === "undefined") return "";

  try {
    const storedTokens = window.sessionStorage.getItem("google-tokens");
    if (storedTokens) {
      const parsed = JSON.parse(storedTokens) as { userEmail?: unknown };
      const tokenEmail =
        typeof parsed.userEmail === "string"
          ? normalizeEmail(parsed.userEmail)
          : "";
      if (tokenEmail) return tokenEmail;
    }
  } catch {
    // Fall back to the account-switch marker below.
  }

  return normalizeEmail(
    window.sessionStorage.getItem("session-user-email") ?? "",
  );
}

function readStoredMnemonic(): StoredRecoveryPhraseSession | null {
  if (typeof window === "undefined") return null;

  try {
    const serialized = window.sessionStorage.getItem(
      RECOVERY_PHRASE_SESSION_KEY,
    );
    if (!serialized) return null;

    const stored = JSON.parse(
      serialized,
    ) as Partial<StoredRecoveryPhraseSession>;
    const currentEmail = readCurrentSessionEmail();
    const storedEmail =
      typeof stored.userEmail === "string"
        ? normalizeEmail(stored.userEmail)
        : "";

    if (
      stored.version !== 1 ||
      typeof stored.phrase !== "string" ||
      !stored.phrase.trim() ||
      !currentEmail ||
      storedEmail !== currentEmail
    ) {
      window.sessionStorage.removeItem(RECOVERY_PHRASE_SESSION_KEY);
      return null;
    }

    return {
      version: 1,
      userEmail: storedEmail,
      phrase: stored.phrase,
    };
  } catch {
    window.sessionStorage.removeItem(RECOVERY_PHRASE_SESSION_KEY);
    return null;
  }
}

function storeMnemonicForCurrentSession(mnemonic: string): void {
  if (typeof window === "undefined") return;

  const userEmail = readCurrentSessionEmail();
  if (!userEmail) {
    window.sessionStorage.removeItem(RECOVERY_PHRASE_SESSION_KEY);
    return;
  }

  const stored: StoredRecoveryPhraseSession = {
    version: 1,
    userEmail,
    phrase: mnemonic,
  };
  window.sessionStorage.setItem(
    RECOVERY_PHRASE_SESSION_KEY,
    JSON.stringify(stored),
  );
}

// Keep a memory copy while the SPA is running; restore it lazily after reload.
let mnemonicCache: string | null = null;
let mnemonicCacheUserEmail = "";
let recoveryPhraseGeneration = 0;

export interface RecoveryPhraseSession {
  phrase: string;
  generation: number;
}

export class RecoveryPhraseChangedError extends Error {
  constructor() {
    super(
      "Recovery & Access changed while ZeroDrive was working. Try the action again.",
    );
    this.name = "RecoveryPhraseChangedError";
  }
}

function notifyRecoveryPhraseChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECOVERY_PHRASE_MEMORY_EVENT));
}

/**
 * Store mnemonic in memory
 */
export function setMnemonic(mnemonic: string): void {
  // A metadata verification is valid only for the recovery phrase that
  // performed it. Always fail closed when the active phrase changes so a
  // different phrase cannot inherit a stale "ready" status and overwrite the
  // encrypted vault index from incomplete local data.
  clearRememberedVaultMetadataStatuses();
  recoveryPhraseGeneration += 1;
  mnemonicCache = mnemonic;
  mnemonicCacheUserEmail = readCurrentSessionEmail();
  storeMnemonicForCurrentSession(mnemonic);
  notifyRecoveryPhraseChanged();
}

/**
 * Get mnemonic from memory
 */
export function getMnemonic(): string | null {
  const currentEmail = readCurrentSessionEmail();
  if (
    mnemonicCache !== null &&
    mnemonicCacheUserEmail &&
    currentEmail &&
    mnemonicCacheUserEmail !== currentEmail
  ) {
    clearMnemonic();
  }

  if (mnemonicCache === null) {
    const stored = readStoredMnemonic();
    mnemonicCache = stored?.phrase ?? null;
    mnemonicCacheUserEmail = stored?.userEmail ?? "";
  }
  return mnemonicCache;
}

/**
 * Clear mnemonic from memory
 */
export function clearMnemonic(): void {
  clearRememberedVaultMetadataStatuses();
  recoveryPhraseGeneration += 1;
  mnemonicCache = null;
  mnemonicCacheUserEmail = "";
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(RECOVERY_PHRASE_SESSION_KEY);
  }
  notifyRecoveryPhraseChanged();
}

/**
 * Check if mnemonic is available
 */
export function hasMnemonic(): boolean {
  return getMnemonic() !== null;
}

export function requireActiveRecoveryPhrase(): string {
  const mnemonic = getMnemonic();
  if (!mnemonic) {
    throw new Error(
      "Open Recovery & Access and enter the recovery phrase for this vault.",
    );
  }
  return mnemonic;
}

export function captureActiveRecoveryPhraseSession(): RecoveryPhraseSession {
  return {
    phrase: requireActiveRecoveryPhrase(),
    generation: recoveryPhraseGeneration,
  };
}

export function getRecoveryPhraseGeneration(): number {
  return recoveryPhraseGeneration;
}

export function assertRecoveryPhraseGeneration(
  expectedGeneration: number,
): void {
  if (expectedGeneration !== recoveryPhraseGeneration) {
    throw new RecoveryPhraseChangedError();
  }
}

export function assertRecoveryPhraseSessionCurrent(
  session: RecoveryPhraseSession,
): void {
  assertRecoveryPhraseGeneration(session.generation);
  if (getMnemonic() !== session.phrase) {
    throw new RecoveryPhraseChangedError();
  }
}
