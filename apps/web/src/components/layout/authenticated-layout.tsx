import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AppProvider, useApp } from "../../contexts/app-context";
import {
  getStoredKey,
  VAULT_KEY_STORAGE_EVENT,
} from "../../utils/cryptoUtils";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasDecryptionError } = useApp();
  const [hasBrowserVaultKey, setHasBrowserVaultKey] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    const refreshBrowserVaultKey = () => {
      getStoredKey()
        .then((key) => {
          if (isMounted) setHasBrowserVaultKey(!!key);
        })
        .catch(() => {
          if (isMounted) setHasBrowserVaultKey(false);
        });
    };

    if (!hasDecryptionError) {
      setHasBrowserVaultKey(null);
      return;
    }

    refreshBrowserVaultKey();
    window.addEventListener(VAULT_KEY_STORAGE_EVENT, refreshBrowserVaultKey);
    window.addEventListener("focus", refreshBrowserVaultKey);

    return () => {
      isMounted = false;
      window.removeEventListener(
        VAULT_KEY_STORAGE_EVENT,
        refreshBrowserVaultKey,
      );
      window.removeEventListener("focus", refreshBrowserVaultKey);
    };
  }, [hasDecryptionError, location.pathname]);

  const shouldShowDecryptionNotice =
    hasDecryptionError && location.pathname !== "/key-management";

  const decryptionNotice =
    hasBrowserVaultKey === false
      ? {
          message:
            "Vault locked — this browser needs your recovery phrase before it can read encrypted vault metadata.",
          action: "Recover access",
        }
      : {
          message:
            "Could not open existing vault metadata — it may belong to another recovery phrase. If this is a new vault, you can start fresh by uploading a file.",
          action: "Review access",
        };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        {/* No chrome — just a way back to the hub */}
        <button
          onClick={() => navigate("/home")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </button>

        {shouldShowDecryptionNotice && (
          <div className="mb-6 flex items-center gap-2 border-2 border-accent-border bg-accent px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-accent-foreground" />
            <span className="text-xs font-medium leading-relaxed text-accent-foreground">
              {decryptionNotice.message}
              <button
                onClick={() => navigate("/key-management")}
                className="ml-1 underline hover:no-underline"
              >
                {decryptionNotice.action}
              </button>
            </span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
    </AppProvider>
  );
}
