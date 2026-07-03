import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Menu } from "lucide-react";
import { SidebarProvider } from "../../contexts/sidebar-context";
import { AppProvider } from "../../contexts/app-context";
import { AppSidebar } from "./app-sidebar";
import { useSidebar } from "../../contexts/sidebar-context";
import { useApp } from "../../contexts/app-context";
import { Button } from "../ui/button";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isMobile, toggle } = useSidebar();
  const { hasDecryptionError } = useApp();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen gap-4 overflow-hidden p-6">
      <AppSidebar />

      <main className="flex-1 overflow-auto py-4">
        {/* No top bar — a floating menu button opens the drawer on mobile */}
        {isMobile && (
          <Button
            variant="outline"
            size="icon"
            className="mb-4"
            onClick={toggle}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {hasDecryptionError && (
          <div className="mb-4 flex items-center gap-2 border-2 border-accent-border bg-accent px-4 py-2">
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

        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
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
      <SidebarProvider>
        <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
      </SidebarProvider>
    </AppProvider>
  );
}
