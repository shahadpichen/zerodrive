import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  HardDrive,
  Send,
  Inbox,
  Key,
  ChevronLeft,
  Upload,
  Trash2,
  Share2,
} from "lucide-react";
import { useSidebar } from "../../contexts/sidebar-context";
import { useApp } from "../../contexts/app-context";
import { Sheet, SheetContent } from "../ui/sheet";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { toast } from "sonner";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navigationItems: NavItem[] = [
  {
    id: "storage",
    label: "Storage",
    icon: HardDrive,
    path: "/storage",
  },
  {
    id: "share",
    label: "Share Files",
    icon: Send,
    path: "/share",
  },
  {
    id: "shared",
    label: "Shared With Me",
    icon: Inbox,
    path: "/shared-with-me",
  },
  {
    id: "keys",
    label: "Key Management",
    icon: Key,
    path: "/key-management",
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { isOpen } = useSidebar();
  const { userEmail, refreshAll } = useApp();
  const [isProcessingSharingKeys, setIsProcessingSharingKeys] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleUpload = () => {
    // Trigger file upload - this will be connected to the file input in the page
    const event = new CustomEvent("trigger-upload");
    window.dispatchEvent(event);
  };

  const handleDeleteAll = () => {
    // Trigger delete all - this will be connected to the delete confirmation in the page
    const event = new CustomEvent("trigger-delete-all");
    window.dispatchEvent(event);
  };

  const handleEnableSharing = async () => {
    if (isProcessingSharingKeys) return;

    setIsProcessingSharingKeys(true);
    try {
      const { generateUserKeyPair, storeUserPublicKey, hashEmail } =
        await import("../../utils/fileSharing");
      const { storeUserKeyPair } = await import("../../utils/keyStorage");
      const { encryptRsaPrivateKeyWithAesKey } =
        await import("../../utils/rsaKeyManager");
      const { uploadEncryptedRsaKeyToDrive } =
        await import("../../utils/gdriveKeyStorage");
      const { getStoredKey } = await import("../../utils/cryptoUtils");

      if (!userEmail) {
        toast.error("User email not found");
        setIsProcessingSharingKeys(false);
        return;
      }

      // Generate RSA key pair
      const { publicKey, privateKey } = await generateUserKeyPair();

      // Store keys in IndexedDB
      await storeUserKeyPair(publicKey, privateKey);

      // Upload public key to backend
      const hashedEmail = await hashEmail(userEmail);
      await storeUserPublicKey(hashedEmail, publicKey);

      // Encrypt and backup private key to Google Drive
      const aesKey = await getStoredKey();
      if (!aesKey) {
        throw new Error("Encryption key not found");
      }

      const encryptedPrivateKey = await encryptRsaPrivateKeyWithAesKey(
        privateKey,
        aesKey,
      );
      await uploadEncryptedRsaKeyToDrive(encryptedPrivateKey);

      toast.success("File sharing enabled successfully!");
      await refreshAll();
    } catch (error) {
      console.error("Error enabling sharing:", error);
      toast.error("Failed to enable file sharing");
    } finally {
      setIsProcessingSharingKeys(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" role="navigation">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={!isOpen ? item.label : undefined}
                className={`flex flex-col px-4 ${isOpen ? "items-start" : "items-center"}`}
              >
                <Button variant="ghost">
                  {!isOpen && <Icon className="h-5 w-5 flex-shrink-0" />}
                  {isOpen && <span>{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <>
          <Separator className="my-4" />
          <div className="space-y-1 flex flex-col px-4">
            <Button
              variant="ghost"
              className={`${isOpen ? "items-start justify-start" : "items-center justify-center"}`}
              onClick={handleUpload}
            >
              {!isOpen && <Upload className="h-5 w-5 flex-shrink-0" />}
              {isOpen && <span>Upload Files</span>}
            </Button>

            <Button
              variant="ghost"
              className={`${isOpen ? "items-start justify-start" : "items-center justify-center"}`}
              onClick={handleEnableSharing}
              disabled={isProcessingSharingKeys}
            >
              {!isOpen && <Share2 className="h-5 w-5 flex-shrink-0" />}
              {isOpen && <span>Enable Sharing</span>}
            </Button>

            <Button
              variant="ghost"
              className={`${isOpen ? "items-start justify-start" : "items-center justify-center"} text-destructive hover:text-destructive`}
              onClick={handleDeleteAll}
            >
              {!isOpen && <Trash2 className="h-5 w-5 flex-shrink-0" />}
              {isOpen && <span>Delete All Files</span>}
            </Button>
          </div>
        </>
      </nav>
    </div>
  );
}

export function AppSidebar() {
  const { isOpen, isMobile, toggle, close } = useSidebar();

  const handleMobileNavigate = () => {
    close();
  };

  if (isMobile) {
    // Mobile: Sheet drawer (triggered by hamburger in header)
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={handleMobileNavigate} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Collapsible sidebar
  return (
    <>
      <aside
        className={`fixed left-0 top-[8vh] h-[92vh] bg-background border-r z-40 ${
          isOpen ? "w-64" : "w-16"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Collapse button - positioned independently for better clickability */}
      <Button
        variant="ghost"
        size="icon"
        className={`fixed h-6 w-6 rounded-full border bg-background shadow-md hover:shadow-lg hover:bg-accent`}
        style={{
          top: "calc(10vh + 1rem)", // Header height + 1rem padding
          left: isOpen ? "243px" : "52px", // 256px - 13px for -right-3 effect, or 64px - 12px
          zIndex: 9999,
        }}
        onClick={toggle}
        aria-label="Toggle sidebar"
      >
        <ChevronLeft className={`h-4 w-4 ${!isOpen ? "rotate-180" : ""}`} />
      </Button>
    </>
  );
}
