import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { HardDrive, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { AUTH_SESSION_CLEARED_EVENT, GOOGLE_DRIVE_PERMISSION_EVENT } from "../utils/authEvents";
import {
  describeMissingGoogleDriveScopes,
  getMissingStoredGoogleDriveScopes,
  type MissingGoogleDriveScope,
} from "../utils/googleDrivePermissions";
import { login, logout } from "../utils/authService";

interface GoogleDrivePermissionContextValue {
  missingScopes: MissingGoogleDriveScope[];
  hasMissingRequiredScopes: boolean;
  refresh: () => void;
  openDialog: () => void;
  closeDialog: () => void;
}

const GoogleDrivePermissionContext =
  createContext<GoogleDrivePermissionContextValue | null>(null);

function readMissingScopes(): MissingGoogleDriveScope[] {
  return getMissingStoredGoogleDriveScopes();
}

export function GoogleDrivePermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [missingScopes, setMissingScopes] =
    useState<MissingGoogleDriveScope[]>(readMissingScopes);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasMissingRequiredScopes = missingScopes.length > 0;

  const refresh = useCallback(() => {
    setMissingScopes(readMissingScopes());
  }, []);

  const openDialog = useCallback(() => {
    refresh();
    setIsDialogOpen(true);
  }, [refresh]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = "/";
  }, []);

  useEffect(() => {
    const handlePermissionChange = () => {
      const nextMissingScopes = readMissingScopes();
      setMissingScopes(nextMissingScopes);
      if (nextMissingScopes.length === 0) {
        setIsDialogOpen(false);
      }
    };

    window.addEventListener(
      GOOGLE_DRIVE_PERMISSION_EVENT,
      handlePermissionChange,
    );
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, handlePermissionChange);

    return () => {
      window.removeEventListener(
        GOOGLE_DRIVE_PERMISSION_EVENT,
        handlePermissionChange,
      );
      window.removeEventListener(
        AUTH_SESSION_CLEARED_EVENT,
        handlePermissionChange,
      );
    };
  }, []);

  const value = useMemo(
    () => ({
      missingScopes,
      hasMissingRequiredScopes,
      refresh,
      openDialog,
      closeDialog,
    }),
    [
      closeDialog,
      hasMissingRequiredScopes,
      missingScopes,
      openDialog,
      refresh,
    ],
  );

  return (
    <GoogleDrivePermissionContext.Provider value={value}>
      {children}

      <Dialog
        open={isDialogOpen && hasMissingRequiredScopes}
        onOpenChange={(open) => {
          if (open) openDialog();
          else closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Google Drive permission is incomplete</DialogTitle>
            <DialogDescription>
              ZeroDrive cannot use Storage or send encrypted shares until
              Google Drive access is granted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>{describeMissingGoogleDriveScopes(missingScopes)}</p>
            <div className="grid gap-3 border p-4 text-foreground sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <HardDrive className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p>
                  Encrypted file copies are saved in your own Google Drive.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p>
                  Hidden encrypted vault metadata lets ZeroDrive list your
                  files safely.
                </p>
              </div>
            </div>
            <p>
              You can close this for now, but Drive actions will stay blocked
              until you grant the missing permissions through Google.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Not now
            </Button>
            <Button type="button" onClick={login}>
              Grant Google Drive access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GoogleDrivePermissionContext.Provider>
  );
}

export function useGoogleDrivePermissions(): GoogleDrivePermissionContextValue {
  const context = useContext(GoogleDrivePermissionContext);
  if (context) return context;

  return {
    missingScopes: [],
    hasMissingRequiredScopes: false,
    refresh: () => undefined,
    openDialog: () => undefined,
    closeDialog: () => undefined,
  };
}

export function GoogleDrivePermissionReminder({
  className = "",
}: {
  className?: string;
}) {
  const permission = useGoogleDrivePermissions();
  if (!permission.hasMissingRequiredScopes) return null;

  return (
    <button
      type="button"
      onClick={permission.openDialog}
      className={`text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground ${className}`}
    >
      Grant Drive access
    </button>
  );
}

export function GoogleDrivePermissionGate({
  children,
  requirePermission = false,
  promptIfMissing = true,
}: {
  children: React.ReactNode;
  requirePermission?: boolean;
  promptIfMissing?: boolean;
}) {
  const permission = useGoogleDrivePermissions();

  useEffect(() => {
    permission.refresh();
    if (promptIfMissing && permission.hasMissingRequiredScopes) {
      permission.openDialog();
    }
    // Run on mount and when a route renders with newly changed scope state.
  }, [
    permission.hasMissingRequiredScopes,
    permission.openDialog,
    permission.refresh,
    promptIfMissing,
  ]);

  if (!requirePermission || !permission.hasMissingRequiredScopes) {
    return <>{children}</>;
  }

  return (
    <section className="border p-8 text-center">
      <HardDrive className="mx-auto h-5 w-5 text-muted-foreground" />
      <h1 className="mt-4 text-xl">Grant Google Drive access first</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        ZeroDrive stores encrypted files in your Google Drive and keeps the
        encrypted vault index in hidden app storage. Grant the missing Google
        Drive permission before using this section.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={permission.openDialog}>
          More details
        </Button>
        <Button type="button" onClick={login}>
          Grant Google Drive access
        </Button>
      </div>
    </section>
  );
}
