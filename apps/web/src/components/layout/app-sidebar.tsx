import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HardDrive,
  Send,
  Inbox,
  Key,
  ChevronLeft,
  Trash2,
  Share2,
  LogOut,
} from "lucide-react";
import { useSidebar } from "../../contexts/sidebar-context";
import { useApp } from "../../contexts/app-context";
import { Sheet, SheetContent } from "../ui/sheet";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ModeToggle } from "../mode-toggle";
import { toast } from "sonner";
import { Button } from "../ui/button";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navigationItems: NavItem[] = [
  { id: "storage", label: "Storage", icon: HardDrive, path: "/storage" },
  { id: "share", label: "Share Files", icon: Send, path: "/share" },
  {
    id: "shared",
    label: "Shared With Me",
    icon: Inbox,
    path: "/shared-with-me",
  },
  {
    id: "keys",
    label: "Recovery & Access",
    icon: Key,
    path: "/recovery-access",
  },
];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getUserInitials(name: string, email: string) {
  const base = name?.trim() || email || "";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (base[0] || "?").toUpperCase();
}

function getProgressColor(pct: number): string {
  if (pct < 60) return "hsl(142.1 76.2% 36.3%)";
  if (pct < 75) return "hsl(47.9 95.8% 53.1%)";
  return "hsl(0 84.2% 60.2%)";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, isMobile } = useSidebar();
  const { userEmail, userName, userImage, storageInfo, refreshAll } = useApp();
  const [isProcessingSharingKeys, setIsProcessingSharingKeys] = useState(false);

  // Show labels on mobile (full drawer) or when the desktop rail is expanded
  const showLabels = isMobile || isOpen;
  const isActive = (path: string) => location.pathname === path;

  const usagePercentage = storageInfo
    ? (storageInfo.used / storageInfo.total) * 100
    : 0;

  const handleDeleteAll = () => {
    window.dispatchEvent(new CustomEvent("trigger-delete-all"));
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("zerodrive-storage-cache");
      const { logout } = await import("../../utils/authService");
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/");
    }
  };

  const handleEnableSharing = async () => {
    if (isProcessingSharingKeys) return;

    setIsProcessingSharingKeys(true);
    try {
      const { generateUserKeyPair, storeUserPublicKey } =
        await import("../../utils/fileSharing");
      const { storeUserKeyPair } = await import("../../utils/keyStorage");
      const { encryptRsaPrivateKeyWithAesKey } =
        await import("../../utils/rsaKeyManager");
      const { uploadEncryptedRsaKeyToDrive } =
        await import("../../utils/gdriveKeyStorage");
      const { getStoredKey } = await import("../../utils/cryptoUtils");
      const { getMnemonic } = await import("../../utils/mnemonicManager");

      if (!userEmail) {
        toast.error("User email not found");
        setIsProcessingSharingKeys(false);
        return;
      }

      const keyPair = await generateUserKeyPair();
      const mnemonic = getMnemonic();
      if (!mnemonic) {
        throw new Error("Mnemonic not found - cannot encrypt RSA private key");
      }
      const storedPublicKey = await storeUserPublicKey(keyPair.publicKeyJwk);
      await storeUserKeyPair(
        userEmail,
        keyPair,
        mnemonic,
        storedPublicKey.keyVersion,
      );

      const aesKey = await getStoredKey();
      if (!aesKey) {
        throw new Error("Encryption key not found");
      }

      const encryptedPrivateKey = await encryptRsaPrivateKeyWithAesKey(
        keyPair.privateKeyJwk,
        aesKey,
      );
      await uploadEncryptedRsaKeyToDrive(encryptedPrivateKey);
      await uploadEncryptedRsaKeyToDrive(
        encryptedPrivateKey,
        storedPublicKey.keyVersion,
      );

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
    <div className="flex h-full flex-col">
      {/* Brand — logo + name; only the logo when collapsed */}
      <div
        className={`flex items-center gap-2 border-b px-3 py-3 ${
          showLabels ? "" : "justify-center"
        }`}
      >
        <img src="/logo192.png" alt="" className="h-8 w-8 flex-shrink-0" />
        {showLabels && <span className="text-base font-bold">ZeroDrive</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2" role="navigation">
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
                title={!showLabels ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  showLabels ? "" : "justify-center"
                } ${active ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {showLabels && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <Separator className="my-3" />

        {showLabels && (
          <p className="mb-1 px-3 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Actions
          </p>
        )}
        <button
          onClick={handleEnableSharing}
          disabled={isProcessingSharingKeys}
          title={!showLabels ? "Enable Sharing" : undefined}
          className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 disabled:opacity-50 ${
            showLabels ? "" : "justify-center"
          }`}
        >
          <Share2 className="h-[18px] w-[18px] flex-shrink-0" />
          {showLabels && <span>Enable Sharing</span>}
        </button>
      </nav>

      {/* Destructive action */}
      <div className="p-2">
        <button
          onClick={handleDeleteAll}
          title={!showLabels ? "Delete All Files" : undefined}
          className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 ${
            showLabels ? "" : "justify-center"
          }`}
        >
          <Trash2 className="h-[18px] w-[18px] flex-shrink-0" />
          {showLabels && <span>Delete All Files</span>}
        </button>
      </div>

      {/* Footer: storage meter + user (moved out of the old top bar) */}
      {userEmail && (
        <div className="space-y-3 border-t p-3">
          {showLabels && storageInfo && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Storage used</span>
                <span>
                  {formatBytes(storageInfo.used)} /{" "}
                  {formatBytes(storageInfo.total)}
                </span>
              </div>
              <Progress
                value={usagePercentage}
                className="h-1.5"
                style={{
                  ["--progress-background" as string]:
                    getProgressColor(usagePercentage),
                }}
              />
            </div>
          )}

          <div
            className={`flex items-center gap-2 ${showLabels ? "" : "justify-center"}`}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={userImage} alt={userName} />
              <AvatarFallback>
                {getUserInitials(userName, userEmail)}
              </AvatarFallback>
            </Avatar>
            {showLabels && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {userName || userEmail}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {userEmail}
                  </div>
                </div>
                <ModeToggle />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const { isOpen, isMobile, toggle, close } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent onNavigate={close} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={`relative flex flex-shrink-0 flex-col border bg-background ${
        isOpen ? "w-80" : "w-16"
      }`}
    >
      {/* Collapse handle — floats on the seam between the two panels */}
      <button
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
      >
        <ChevronLeft className={`h-4 w-4 ${isOpen ? "" : "rotate-180"}`} />
      </button>

      <SidebarContent />
    </aside>
  );
}
