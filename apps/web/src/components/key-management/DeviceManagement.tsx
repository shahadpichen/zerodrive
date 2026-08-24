import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  Loader2,
  LockKeyhole,
  MonitorSmartphone,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { prepareForAuthSessionClear } from "../../utils/authEvents";
import { clearStoredKey } from "../../utils/cryptoUtils";
import { clearMnemonic } from "../../utils/mnemonicManager";
import {
  getVaultAccessKind,
  type VaultAccessKind,
} from "../../utils/vaultAccess";

interface DeviceManagementProps {
  refreshKey?: number;
}

export function DeviceManagement({ refreshKey = 0 }: DeviceManagementProps) {
  const [accessKind, setAccessKind] = useState<VaultAccessKind>("none");
  const [isChecking, setIsChecking] = useState(true);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    let active = true;

    const checkKeyStatus = async () => {
      setIsChecking(true);
      try {
        const nextAccessKind = await getVaultAccessKind();
        if (active) setAccessKind(nextAccessKind);
      } catch {
        if (active) setAccessKind("none");
      } finally {
        if (active) setIsChecking(false);
      }
    };

    void checkKeyStatus();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const hasKey = accessKind !== "none";

  const lockVault = async () => {
    if (isLocking) return;
    setIsLocking(true);
    try {
      // Let queued work stop while it can still clean up with the active key.
      await prepareForAuthSessionClear();
      clearMnemonic();
      clearStoredKey();
      setAccessKind("none");
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <aside className="border">
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4" />
          <h2 className="text-sm font-semibold">This browser tab</h2>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Vault access stays active in this tab, including after a reload, until
          you sign out, lock the vault, or the tab session ends.
        </p>
      </div>

      <div className="p-5">
        {isChecking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking key status
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center border ${
                  hasKey ? "bg-foreground text-background" : ""
                }`}
              >
                {hasKey ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {hasKey
                    ? accessKind === "recovery_phrase"
                      ? "Recovery phrase active"
                      : "Legacy key active"
                    : "No recovery phrase active"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hasKey
                    ? accessKind === "recovery_phrase"
                      ? "You can encrypt and decrypt files until this tab or session is cleared."
                      : "You can open historical files in this tab. Enter a recovery phrase before creating or changing vault data."
                    : "Recover an existing key or create a new one to access encrypted files."}
                </p>
              </div>
              {hasKey && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  disabled={isLocking}
                  onClick={() => void lockVault()}
                >
                  {isLocking ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LockKeyhole className="mr-2 h-3.5 w-3.5" />
                  )}
                  Lock vault
                </Button>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-start gap-2 text-xs">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>The key is never sent to the ZeroDrive server.</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Use the same recovery phrase on another device to restore
                  access.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
