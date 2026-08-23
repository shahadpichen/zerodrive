import { toast } from "sonner";
import { login } from "./authService";

export const DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";
export const FULL_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export type MissingGoogleDriveScope = "drive.file" | "drive.appdata";
export type GoogleDrivePermissionIntent =
  | "storage"
  | "upload"
  | "folder"
  | "share"
  | "save";

interface StoredGoogleTokens {
  scope?: string;
}

const intentCopy: Record<
  GoogleDrivePermissionIntent,
  { title: string; description: string }
> = {
  storage: {
    title: "Google Drive permission is incomplete",
    description:
      "Grant Drive access before opening encrypted Storage.",
  },
  upload: {
    title: "Google Drive permission is incomplete",
    description:
      "Grant Drive access before uploading encrypted files.",
  },
  folder: {
    title: "Google Drive permission is incomplete",
    description:
      "Grant Drive access before creating encrypted folders.",
  },
  share: {
    title: "Google Drive permission is incomplete",
    description:
      "Grant Drive access before creating an encrypted share.",
  },
  save: {
    title: "Google Drive permission is incomplete",
    description:
      "Grant Drive access before saving this shared file to Storage.",
  },
};

export function parseGoogleScopes(scope: string | null | undefined): Set<string> {
  return new Set((scope || "").split(/\s+/).filter(Boolean));
}

export function getMissingRequiredGoogleDriveScopes(
  scope: string | null | undefined,
): MissingGoogleDriveScope[] {
  const scopes = parseGoogleScopes(scope);
  const hasFileScope =
    scopes.has(DRIVE_FILE_SCOPE) || scopes.has(FULL_DRIVE_SCOPE);
  const hasAppDataScope = scopes.has(DRIVE_APPDATA_SCOPE);
  const missing: MissingGoogleDriveScope[] = [];

  if (!hasFileScope) missing.push("drive.file");
  if (!hasAppDataScope) missing.push("drive.appdata");

  return missing;
}

export function hasRequiredGoogleDriveScopes(
  scope: string | null | undefined,
): boolean {
  return getMissingRequiredGoogleDriveScopes(scope).length === 0;
}

export function readStoredGoogleTokenScope(): string | null {
  try {
    const storedData = sessionStorage.getItem("google-tokens");
    if (!storedData) return null;

    const parsed = JSON.parse(storedData) as StoredGoogleTokens;
    return typeof parsed.scope === "string" ? parsed.scope : null;
  } catch {
    return null;
  }
}

export function getMissingStoredGoogleDriveScopes(): MissingGoogleDriveScope[] {
  const scope = readStoredGoogleTokenScope();
  if (scope === null) return [];
  return getMissingRequiredGoogleDriveScopes(scope);
}

export function hasStoredRequiredGoogleDriveScopes(): boolean {
  return getMissingStoredGoogleDriveScopes().length === 0;
}

export function describeMissingGoogleDriveScopes(
  missingScopes: MissingGoogleDriveScope[],
): string {
  if (missingScopes.length === 0) {
    return "Google Drive access is ready.";
  }

  if (missingScopes.includes("drive.file") && missingScopes.includes("drive.appdata")) {
    return "ZeroDrive needs permission for encrypted files and hidden vault metadata.";
  }

  if (missingScopes.includes("drive.file")) {
    return "ZeroDrive needs permission for the encrypted files you choose to use with the app.";
  }

  return "ZeroDrive needs permission for hidden encrypted vault metadata.";
}

export function showMissingGoogleDrivePermissionToast(
  intent: GoogleDrivePermissionIntent,
): void {
  const copy = intentCopy[intent];

  toast.warning(copy.title, {
    description: copy.description,
    action: {
      label: "Grant access",
      onClick: login,
    },
  });
}

export function ensureGoogleDrivePermissionForAction(
  intent: GoogleDrivePermissionIntent,
): boolean {
  if (hasStoredRequiredGoogleDriveScopes()) return true;

  showMissingGoogleDrivePermissionToast(intent);
  return false;
}
