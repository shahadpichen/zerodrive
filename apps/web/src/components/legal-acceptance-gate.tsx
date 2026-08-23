import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import apiClient, { type LegalAcceptanceStatus } from "../utils/apiClient";
import { AUTH_SESSION_CLEARED_EVENT } from "../utils/authEvents";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useGoogleDrivePermissions } from "./google-drive-permission-gate";

interface RefreshOptions {
  promptIfRequired?: boolean;
}

interface LegalAcceptanceContextValue {
  status: LegalAcceptanceStatus | null;
  isLoading: boolean;
  isAccepting: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<LegalAcceptanceStatus | null>;
  accept: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
}

const acceptedFallback: LegalAcceptanceStatus = {
  accepted: true,
  required: true,
  termsVersion: "unknown",
  privacyVersion: "unknown",
  acceptedAt: null,
};

const LegalAcceptanceContext =
  createContext<LegalAcceptanceContextValue | null>(null);

function legalVersionKey(status: LegalAcceptanceStatus): string {
  return `${status.termsVersion}:${status.privacyVersion}`;
}

export function LegalAcceptanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<LegalAcceptanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const promptedVersionRef = useRef<string | null>(null);

  const openDialog = useCallback(() => {
    setError(null);
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setHasAcknowledged(false);
  }, []);

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const nextStatus = await apiClient.legalAcceptance.getStatus();
        setStatus(nextStatus);

        const versionKey = legalVersionKey(nextStatus);
        if (
          options.promptIfRequired &&
          !nextStatus.accepted &&
          promptedVersionRef.current !== versionKey
        ) {
          promptedVersionRef.current = versionKey;
          openDialog();
        }

        return nextStatus;
      } catch (refreshError) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : "Legal acceptance status could not be checked.";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [openDialog],
  );

  const accept = useCallback(async () => {
    if (!hasAcknowledged) return;

    setIsAccepting(true);
    setError(null);
    try {
      const nextStatus = await apiClient.legalAcceptance.accept();
      setStatus(nextStatus);
      promptedVersionRef.current = legalVersionKey(nextStatus);
      setIsDialogOpen(false);
      setHasAcknowledged(false);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Legal acceptance could not be saved.",
      );
    } finally {
      setIsAccepting(false);
    }
  }, [hasAcknowledged]);

  useEffect(() => {
    const resetAcceptanceState = () => {
      setStatus(null);
      setIsLoading(false);
      setIsAccepting(false);
      setError(null);
      setIsDialogOpen(false);
      setHasAcknowledged(false);
      promptedVersionRef.current = null;
    };

    window.addEventListener(
      AUTH_SESSION_CLEARED_EVENT,
      resetAcceptanceState,
    );
    return () =>
      window.removeEventListener(
        AUTH_SESSION_CLEARED_EVENT,
        resetAcceptanceState,
      );
  }, []);

  const value = useMemo(
    () => ({
      status,
      isLoading,
      isAccepting,
      error,
      refresh,
      accept,
      openDialog,
      closeDialog,
    }),
    [
      accept,
      closeDialog,
      error,
      isAccepting,
      isLoading,
      openDialog,
      refresh,
      status,
    ],
  );

  return (
    <LegalAcceptanceContext.Provider value={value}>
      {children}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (open) openDialog();
          else closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Review Terms and Privacy</DialogTitle>
            <DialogDescription>
              ZeroDrive needs this acknowledgement before Storage and private
              file sharing are enabled for this account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              ZeroDrive stores encrypted files in your own Google Drive. Your
              recovery phrase stays local, and ZeroDrive cannot read your
              original files or reset that phrase.
            </p>
            <p>
              The acceptance record is stored separately from file and share
              records. It contains a privacy-safe account lookup ID, the Terms
              and Privacy Policy versions, and the acceptance time.
            </p>
            <div className="flex items-start gap-3 border p-4 text-foreground">
              <Checkbox
                id="authenticated-legal-acknowledgement"
                checked={hasAcknowledged}
                onCheckedChange={(checked) =>
                  setHasAcknowledged(checked === true)
                }
                disabled={isAccepting}
                className="mt-1"
              />
              <label
                htmlFor="authenticated-legal-acknowledgement"
                className="text-sm leading-relaxed"
              >
                I agree to the{" "}
                <Link to="/terms" className="underline underline-offset-4">
                  Terms of Service
                </Link>{" "}
                and acknowledge the{" "}
                <Link to="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {error && (
              <p className="border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isAccepting}
            >
              Not now
            </Button>
            <Button
              type="button"
              onClick={accept}
              disabled={isAccepting || !hasAcknowledged}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Accept and continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LegalAcceptanceContext.Provider>
  );
}

export function useLegalAcceptance(): LegalAcceptanceContextValue {
  const context = useContext(LegalAcceptanceContext);
  if (context) return context;

  return {
    status: acceptedFallback,
    isLoading: false,
    isAccepting: false,
    error: null,
    refresh: async () => acceptedFallback,
    accept: async () => undefined,
    openDialog: () => undefined,
    closeDialog: () => undefined,
  };
}

export function LegalAcceptanceReminder({
  className = "",
}: {
  className?: string;
}) {
  const legal = useLegalAcceptance();
  if (legal.status?.accepted !== false) return null;

  return (
    <button
      type="button"
      onClick={legal.openDialog}
      className={`text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground ${className}`}
    >
      Review Terms
    </button>
  );
}

export function LegalAcceptanceGate({
  children,
  requireAcceptance = false,
  promptIfRequired = true,
}: {
  children: React.ReactNode;
  requireAcceptance?: boolean;
  promptIfRequired?: boolean;
}) {
  const legal = useLegalAcceptance();
  const drivePermissions = useGoogleDrivePermissions();
  const { refresh } = legal;

  useEffect(() => {
    void refresh({
      promptIfRequired:
        promptIfRequired && !drivePermissions.hasMissingRequiredScopes,
    });
  }, [drivePermissions.hasMissingRequiredScopes, promptIfRequired, refresh]);

  if (!requireAcceptance) {
    return <>{children}</>;
  }

  if (legal.isLoading && !legal.status) {
    return (
      <section className="border p-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        <h1 className="mt-4 text-xl">Checking Terms and Privacy</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Storage and sharing will open after ZeroDrive confirms this account
          has accepted the current documents.
        </p>
      </section>
    );
  }

  if (legal.error && !legal.status) {
    return (
      <section className="border p-8 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
        <h1 className="mt-4 text-xl">Could not check Terms and Privacy</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          ZeroDrive could not verify legal acceptance for this account. Try
          again before using Storage or private sharing.
        </p>
        <Button
          type="button"
          className="mt-5"
          onClick={() => void legal.refresh({ promptIfRequired: true })}
        >
          Try again
        </Button>
      </section>
    );
  }

  if (legal.status?.accepted === false) {
    return (
      <section className="border p-8 text-center">
        <ShieldCheck className="mx-auto h-5 w-5 text-muted-foreground" />
        <h1 className="mt-4 text-xl">Review Terms and Privacy first</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          ZeroDrive keeps this acceptance separate from your encrypted files and
          private share records. After accepting, Storage and sharing will open.
        </p>
        <Button type="button" className="mt-5" onClick={legal.openDialog}>
          Review and accept
        </Button>
      </section>
    );
  }

  return <>{children}</>;
}
