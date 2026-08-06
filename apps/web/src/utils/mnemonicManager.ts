/**
 * Mnemonic Manager
 * Securely manages mnemonic phrase in memory (cleared on page refresh)
 */

import { toast } from "sonner";
import { clearRememberedVaultMetadataStatuses } from "./vaultMetadataWriteGuard";

export const RECOVERY_PHRASE_MEMORY_EVENT =
  "zerodrive-recovery-phrase-memory-changed";

// In-memory storage for mnemonic (cleared on page refresh/navigation)
let mnemonicCache: string | null = null;
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
  notifyRecoveryPhraseChanged();
}

/**
 * Get mnemonic from memory
 */
export function getMnemonic(): string | null {
  return mnemonicCache;
}

/**
 * Clear mnemonic from memory
 */
export function clearMnemonic(): void {
  clearRememberedVaultMetadataStatuses();
  recoveryPhraseGeneration += 1;
  mnemonicCache = null;
  notifyRecoveryPhraseChanged();
}

/**
 * Check if mnemonic is available
 */
export function hasMnemonic(): boolean {
  return mnemonicCache !== null;
}

export function requireActiveRecoveryPhrase(): string {
  if (!mnemonicCache) {
    throw new Error(
      "Open Recovery & Access and enter the recovery phrase for this vault.",
    );
  }
  return mnemonicCache;
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
  if (mnemonicCache !== session.phrase) {
    throw new RecoveryPhraseChangedError();
  }
}

/**
 * Check if mnemonic is available and show user-friendly prompt if not
 * @param featureName Optional name of feature requiring mnemonic (for better error message)
 * @returns true if mnemonic is available, false otherwise
 */
export function requireMnemonicWithPrompt(featureName?: string): boolean {
  if (hasMnemonic()) {
    return true;
  }

  const feature = featureName || 'this feature';
  toast.error('Mnemonic Required', {
    description: `Please enter your recovery phrase in Recovery & Access to use ${feature}.`,
    duration: 5000,
  });

  return false;
}
