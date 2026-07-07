import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  X,
} from "lucide-react";
import { getStoredKey } from "../../utils/cryptoUtils";

interface DeviceManagementProps {
  refreshKey?: number;
}

export function DeviceManagement({ refreshKey = 0 }: DeviceManagementProps) {
  const [hasKey, setHasKey] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkKeyStatus = async () => {
      setIsChecking(true);
      try {
        const key = await getStoredKey();
        if (active) setHasKey(Boolean(key));
      } catch {
        if (active) setHasKey(false);
      } finally {
        if (active) setIsChecking(false);
      }
    };

    checkKeyStatus();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <aside className="border">
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4" />
          <h2 className="text-sm font-semibold">This browser tab</h2>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Encryption keys are kept only for the current browser session.
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
              <div>
                <p className="text-sm font-medium">
                  {hasKey
                    ? "Encryption key active"
                    : "No encryption key active"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hasKey
                    ? "You can encrypt and decrypt files until this tab or session is cleared."
                    : "Recover an existing key or create a new one to access encrypted files."}
                </p>
              </div>
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
