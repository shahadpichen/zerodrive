import type { VaultMetadataStatus } from "../contexts/vault-data-context";
import { userNotifications } from "./userNotifications";

const VAULT_METADATA_STATUS_KEY = "zerodrive:vault-metadata-status:v2";

const normalizeEmail = (userEmail: string) => userEmail.trim().toLowerCase();

type StoredVaultMetadataStatuses = Record<string, VaultMetadataStatus>;

function readStatuses(): StoredVaultMetadataStatuses {
  try {
    const raw = window.sessionStorage.getItem(VAULT_METADATA_STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStatuses(statuses: StoredVaultMetadataStatuses) {
  try {
    window.sessionStorage.setItem(
      VAULT_METADATA_STATUS_KEY,
      JSON.stringify(statuses),
    );
  } catch {
    // If sessionStorage is unavailable, writes should still fail closed through
    // assertCanWriteVaultMetadata because no trusted ready status can be read.
  }
}

export function rememberVaultMetadataStatus(
  userEmail: string,
  status: VaultMetadataStatus,
) {
  const email = normalizeEmail(userEmail);
  if (!email) return;
  writeStatuses({
    ...readStatuses(),
    [email]: status,
  });
}

export function clearRememberedVaultMetadataStatuses() {
  try {
    window.sessionStorage.removeItem(VAULT_METADATA_STATUS_KEY);
  } catch {
    // No-op.
  }
}

export function getRememberedVaultMetadataStatus(
  userEmail: string,
): VaultMetadataStatus {
  const email = normalizeEmail(userEmail);
  return readStatuses()[email] ?? "unverified";
}

export function getVaultMetadataWriteBlockMessage() {
  return "Refresh Storage before changing files or folders so ZeroDrive does not replace an existing encrypted file list with stale local data.";
}

export function showVaultMetadataWriteBlockedToast() {
  userNotifications.error("Encrypted file list could not be verified", {
    description: getVaultMetadataWriteBlockMessage(),
    id: "vault:metadata-write-blocked",
  });
}

export function assertCanWriteVaultMetadata(
  userEmail: string,
  options: { allowMetadataReplacement?: boolean } = {},
) {
  const status = getRememberedVaultMetadataStatus(userEmail);
  if (status === "ready") return;
  if (options.allowMetadataReplacement && status === "decryption_error") {
    return;
  }

  throw new Error(getVaultMetadataWriteBlockMessage());
}
