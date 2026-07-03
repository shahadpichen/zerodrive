import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AppProvider, useApp } from "../../contexts/app-context";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { hasDecryptionError } = useApp();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* No chrome — just a way back to the hub */}
        <button
          onClick={() => navigate("/home")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </button>

        {hasDecryptionError && (
          <div className="mb-6 flex items-center gap-2 border-2 border-accent-border bg-accent px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-accent-foreground" />
            <span className="text-xs font-medium text-accent-foreground">
              Decryption failed —
              <button
                onClick={() => navigate("/key-management")}
                className="ml-1 underline hover:no-underline"
              >
                update encryption key
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
