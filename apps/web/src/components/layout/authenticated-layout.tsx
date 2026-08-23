import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useVaultData } from "../../contexts/vault-data-context";
import {
  consumeVaultIndexMigrationNotice,
  VAULT_INDEX_MIGRATION_NOTICE_EVENT,
} from "../../utils/vaultIndexDriveStorage";
import { LegalAcceptanceReminder } from "../legal-acceptance-gate";
import { GoogleDrivePermissionReminder } from "../google-drive-permission-gate";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: vaultState } = useVaultData();
  const recoveryPath = `/recovery-access?returnTo=${encodeURIComponent(
    location.pathname,
  )}`;
  const [showVaultIndexMigrationNotice, setShowVaultIndexMigrationNotice] =
    useState(false);

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
    vaultState.metadataStatus === "decryption_error" &&
    location.pathname !== "/recovery-access";

  const decryptionNotice =
    vaultState.hasVaultKey === false
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate("/home")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </button>
          <div className="flex items-center gap-3">
            <GoogleDrivePermissionReminder />
            <LegalAcceptanceReminder />
          </div>
        </div>

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
            storage. The old visible <code>db-list.json</code> safety copy is no
            longer used; keep it until your files look right.
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
