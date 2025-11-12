/**
 * Mnemonic Manager
 * Securely manages mnemonic phrase in memory (cleared on page refresh)
 */

import { toast } from 'sonner';

// In-memory storage for mnemonic (cleared on page refresh/navigation)
let mnemonicCache: string | null = null;

/**
 * Store mnemonic in memory
 */
export function setMnemonic(mnemonic: string): void {
  mnemonicCache = mnemonic;
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
  mnemonicCache = null;
}

/**
 * Check if mnemonic is available
 */
export function hasMnemonic(): boolean {
  return mnemonicCache !== null;
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
    description: `Please enter your mnemonic in Key Management to use ${feature}.`,
    duration: 5000,
  });

  return false;
}
