import { getStoredKey } from "./cryptoUtils";
import { userHasStoredKeys } from "./keyStorage";
import { getMnemonic } from "./mnemonicManager";

export const ONBOARDING_DISMISS_KEY = "zerodrive-onboarding-guidance-dismissed";

export type VaultSetupStatus =
  | "needs_key"
  | "key_ready_empty_vault"
  | "vault_ready";

export interface VaultSetupSnapshot {
  isAuthenticated: boolean;
  hasGoogleTokens: boolean;
  hasPrimaryKey: boolean;
  hasRecoveryPhrase: boolean;
  fileCount: number;
  folderCount: number;
  hasSharingKeys: boolean;
  hasDecryptionError?: boolean;
  guidanceDismissed?: boolean;
}

export interface VaultSetupTask {
  id: "key" | "recovery" | "first_file" | "sharing";
  label: string;
  description: string;
  complete: boolean;
  actionLabel?: string;
  actionPath?: string;
  optional?: boolean;
}

export interface VaultSetupState {
  status: VaultSetupStatus;
  badge: string;
  headline: string;
  description: string;
  primaryActionLabel: string;
  primaryActionPath: string;
  secondaryActionLabel?: string;
  secondaryActionPath?: string;
  tasks: VaultSetupTask[];
  shouldShowGuidance: boolean;
}

export function isOnboardingGuidanceDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissOnboardingGuidance(): void {
  try {
    localStorage.setItem(ONBOARDING_DISMISS_KEY, "true");
  } catch {
    // Local-only preference. Ignore storage failures.
  }
}

export async function readBrowserVaultSetupSnapshot(
  email: string,
  options: Pick<
    VaultSetupSnapshot,
    | "isAuthenticated"
    | "hasGoogleTokens"
    | "fileCount"
    | "folderCount"
    | "hasDecryptionError"
  >,
): Promise<VaultSetupSnapshot> {
  const [primaryKey, hasSharingKeys] = await Promise.all([
    getStoredKey(),
    userHasStoredKeys(email),
  ]);

  return {
    ...options,
    hasPrimaryKey: !!primaryKey,
    hasRecoveryPhrase: !!getMnemonic(),
    hasSharingKeys,
    guidanceDismissed: isOnboardingGuidanceDismissed(),
  };
}

export function getVaultSetupState(
  snapshot: VaultSetupSnapshot,
): VaultSetupState {
  const hasVaultContents = snapshot.fileCount > 0 || snapshot.folderCount > 0;

  const tasks: VaultSetupTask[] = [
    {
      id: "key",
      label: "Create or recover vault access",
      description:
        "This browser needs your encryption key before it can protect files.",
      complete: snapshot.hasPrimaryKey,
      actionLabel: "Set up access",
      actionPath: "/key-management",
    },
    {
      id: "recovery",
      label: "Keep your recovery phrase safe",
      description:
        "ZeroDrive cannot reset this phrase, so store it somewhere you trust.",
      complete: snapshot.hasRecoveryPhrase,
      actionLabel: "Review recovery",
      actionPath: "/key-management",
    },
    {
      id: "first_file",
      label: "Upload your first encrypted file",
      description:
        "Your browser encrypts the file before it is stored in Google Drive.",
      complete: hasVaultContents,
      actionLabel: "Upload first file",
      actionPath: "/storage",
    },
    {
      id: "sharing",
      label: "Create your sharing identity",
      description:
        "Optional: lets other people encrypt files specifically for you.",
      complete: snapshot.hasSharingKeys,
      actionLabel: "Set up sharing",
      actionPath: "/share",
      optional: true,
    },
  ];

  if (!snapshot.hasPrimaryKey || snapshot.hasDecryptionError) {
    return {
      status: "needs_key",
      badge: "Vault setup",
      headline: "Create or recover vault access",
      description:
        "This browser needs your encryption key before it can open encrypted files. Create a new vault key or recover your existing one with your recovery phrase.",
      primaryActionLabel: "Create or recover access",
      primaryActionPath: "/key-management",
      secondaryActionLabel: "Go to Storage",
      secondaryActionPath: "/storage",
      tasks,
      shouldShowGuidance: true,
    };
  }

  if (!hasVaultContents) {
    return {
      status: "key_ready_empty_vault",
      badge: "Vault ready",
      headline: "Your vault is ready",
      description:
        "Your encryption key is active in this browser. Upload a file and ZeroDrive will encrypt it before storing it.",
      primaryActionLabel: "Upload first encrypted file",
      primaryActionPath: "/storage",
      secondaryActionLabel: snapshot.hasSharingKeys
        ? "Share a file"
        : "Create sharing identity",
      secondaryActionPath: snapshot.hasSharingKeys ? "/share" : "/share",
      tasks,
      shouldShowGuidance: !snapshot.guidanceDismissed,
    };
  }

  return {
    status: "vault_ready",
    badge: "Vault active",
    headline: "Welcome back to your private vault",
    description:
      "Your encrypted storage is ready. Recent files, sharing, recovery, and inbox access are all one step away.",
    primaryActionLabel: "Open Storage",
    primaryActionPath: "/storage",
    secondaryActionLabel: snapshot.hasSharingKeys
      ? "Share a file"
      : "Create sharing identity",
    secondaryActionPath: "/share",
    tasks,
    shouldShowGuidance: !snapshot.hasSharingKeys && !snapshot.guidanceDismissed,
  };
}
