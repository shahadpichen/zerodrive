import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useApp } from "../../contexts/app-context";
import {
  RECOVERY_PHRASE_MEMORY_EVENT,
} from "../../utils/mnemonicManager";
import { VAULT_KEY_STORAGE_EVENT } from "../../utils/cryptoUtils";
import { hasVaultReadAccess } from "../../utils/vaultAccess";
import {
  consumeVaultIndexMigrationNotice,
  VAULT_INDEX_MIGRATION_NOTICE_EVENT,
} from "../../utils/vaultIndexDriveStorage";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasDecryptionError } = useApp();
  const recoveryPath = `/recovery-access?returnTo=${encodeURIComponent(
    location.pathname,
  )}`;
  const [hasBrowserVaultKey, setHasBrowserVaultKey] = useState<boolean | null>(
    null,
  );
  const [showVaultIndexMigrationNotice, setShowVaultIndexMigrationNotice] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    const refreshBrowserVaultKey = async () => {
      const hasAccess = await hasVaultReadAccess();
      if (isMounted) setHasBrowserVaultKey(hasAccess);
    };

    if (!hasDecryptionError) {
      setHasBrowserVaultKey(null);
      return;
    }

    void refreshBrowserVaultKey();
    window.addEventListener(
      RECOVERY_PHRASE_MEMORY_EVENT,
      refreshBrowserVaultKey,
    );
    window.addEventListener(VAULT_KEY_STORAGE_EVENT, refreshBrowserVaultKey);
    window.addEventListener("focus", refreshBrowserVaultKey);

    return () => {
      isMounted = false;
      window.removeEventListener(
        RECOVERY_PHRASE_MEMORY_EVENT,
        refreshBrowserVaultKey,
      );
      window.removeEventListener(
        VAULT_KEY_STORAGE_EVENT,
        refreshBrowserVaultKey,
      );
      window.removeEventListener("focus", refreshBrowserVaultKey);
    };
  }, [hasDecryptionError, location.pathname]);

  useEffect(() => {
    const refreshMigrationNotice = () => {
      setShowVaultIndexMigrationNotice(consumeVaultIndexMigrationNotice());
    };

    refreshMigrationNotice();
    window.addEventListener(
      VAULT_INDEX_MIGRATION_NOTICE_EVENT,
      refreshMigrationNotice,
    );

    return () => {
      window.removeEventListener(
        VAULT_INDEX_MIGRATION_NOTICE_EVENT,
        refreshMigrationNotice,
      );
    };
  }, [location.pathname]);

  const shouldShowDecryptionNotice =
    hasDecryptionError && location.pathname !== "/recovery-access";

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
                onClick={() => navigate(recoveryPath)}
                className="ml-1 underline hover:no-underline"
              >
                {decryptionNotice.action}
              </button>
            </span>
          </div>
        )}

        {showVaultIndexMigrationNotice && (
          <div className="mb-6 border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            ZeroDrive moved your encrypted file list to hidden Google app
            storage. The old visible <code>db-list.json</code> safety copy is
            no longer used; keep it until your files look right.
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
  return <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>;
}
