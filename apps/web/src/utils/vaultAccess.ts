import { getStoredKey } from "./cryptoUtils";
import { hasMnemonic } from "./mnemonicManager";

export type VaultAccessKind =
  | "recovery_phrase"
  | "legacy_imported_key"
  | "none";

/**
 * Capsule v1 writes always require the active tab-session recovery phrase. An
 * imported legacy JSON key grants read access only to historical ZeroDrive
 * objects.
 */
export async function getVaultAccessKind(): Promise<VaultAccessKind> {
  if (hasMnemonic()) return "recovery_phrase";
  return (await getStoredKey()) ? "legacy_imported_key" : "none";
}

export async function hasVaultReadAccess(): Promise<boolean> {
  return (await getVaultAccessKind()) !== "none";
}
