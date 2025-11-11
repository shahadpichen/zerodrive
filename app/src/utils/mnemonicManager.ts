/**
 * Mnemonic Manager
 * Securely manages mnemonic phrase in memory (cleared on page refresh)
 */

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
