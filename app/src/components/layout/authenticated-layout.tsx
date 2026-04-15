import React from "react";
import { SidebarProvider } from "../../contexts/sidebar-context";
import { AppProvider } from "../../contexts/app-context";
import { AppSidebar } from "./app-sidebar";
import { useSidebar } from "../../contexts/sidebar-context";
import Header from "../storage/header";

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOpen, isMobile } = useSidebar();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />

        <main
          className={`flex-1 overflow-auto transition-all duration-300 ${
            !isMobile && isOpen ? "md:ml-64" : !isMobile ? "md:ml-16" : ""
          }`}
        >
          <div className="mx-auto p-6 max-w-7xl">{children}</div>
        </main>
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
      <SidebarProvider>
        <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
      </SidebarProvider>
    </AppProvider>
  );
}
