import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardDrive,
  Send,
  Inbox,
  Key,
  ChevronRight,
  Check,
  AlertTriangle,
  LogOut,
  BarChart3,
} from "lucide-react";
import { AppProvider, useApp } from "../contexts/app-context";
import { ModeToggle } from "../components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Progress } from "../components/ui/progress";
import { getFileIconPath } from "../lib/mime-types";
import {
  FileMeta,
  getAllFilesForUser,
  getFoldersForUser,
  fetchAndStoreFileMetadata,
} from "../utils/dexieDB";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";
import { toast } from "sonner";

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function initials(name: string, email: string) {
  const base = name?.trim() || email || "";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (base[0] || "?").toUpperCase();
}

// A fresh, useful tip is shown on each visit.
const TIPS = [
  "Your files are encrypted on your device before they ever reach Google Drive.",
  "Drag a file onto a folder — or the breadcrumb — to move it.",
  "Your 12-word recovery phrase is the only way to restore access. Keep it somewhere safe.",
  "Lose your recovery phrase and no one can recover your files — not even us. That's the point.",
  "Drop files anywhere on the Storage page to upload them.",
  "Share a file by email and only the intended recipient can decrypt it.",
  "Switch between grid and list view, sort, and filter from the toolbar.",
  "Rename or delete a folder from its menu — in both grid and list view.",
  "Your keys are backed up to Google Drive, encrypted, so you can recover on any device.",
  "Everything here is open source — you can audit exactly how your files are protected.",
];

function HomeContent() {
  const navigate = useNavigate();
  const {
    userEmail,
    userName,
    userImage,
    storageInfo,
    setUserInfo,
    setDecryptionError,
  } = useApp();

  const [counts, setCounts] = useState({ files: 0, folders: 0 });
  const [recent, setRecent] = useState<FileMeta[]>([]);
  const [canReadAnalytics, setCanReadAnalytics] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const {
          hasGoogleTokensInStorage,
          logout,
          getUserProfile,
          getAuthenticatedUser,
        } = await import("../utils/authService");

        const authenticatedUser = await getAuthenticatedUser();
        const email = authenticatedUser?.email;
        if (!email) {
          await logout();
          window.location.href = "/";
          return;
        }

        setCanReadAnalytics(
          !!authenticatedUser?.capabilities.analyticsRead,
        );

        if (!hasGoogleTokensInStorage()) {
          await logout();
          window.location.href = "/";
          return;
        }

        const { initializeGapi } = await import("../utils/gapiInit");
        try {
          await initializeGapi();
        } catch (e) {
          console.error("Failed to initialize Google API:", e);
          return;
        }

        try {
          const profile = await getUserProfile();
          if (profile) {
            setUserInfo(profile.email, profile.name, profile.picture);
          } else {
            setUserInfo(email, email.split("@")[0]);
          }
        } catch {
          setUserInfo(email, email.split("@")[0]);
        }

        try {
          await fetchAndStoreFileMetadata();
          setDecryptionError(false);
        } catch (err: any) {
          if (err?.name === "DecryptionError") setDecryptionError(true);
        }

        const [files, folders] = await Promise.all([
          getAllFilesForUser(email),
          getFoldersForUser(email),
        ]);
        setCounts({ files: files.length, folders: folders.length });
        setRecent(
          [...files]
            .sort(
              (a, b) =>
                new Date(b.uploadedDate).getTime() -
                new Date(a.uploadedDate).getTime(),
            )
            .slice(0, 5),
        );

        await recoverRsaKeysIfNeeded(email, false);
      } catch (error) {
        console.error("[Home] Failed to load dashboard:", error);
        toast.error("Failed to load your dashboard");
      }
    };

    bootstrap();
  }, [setUserInfo, setDecryptionError]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("zerodrive-storage-cache");
      const { logout } = await import("../utils/authService");
      await logout();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  const usagePercentage = storageInfo
    ? (storageInfo.used / storageInfo.total) * 100
    : 0;

  const firstName = (userName || "").split(/\s+/)[0];

  const navCards = [
    {
      title: "Storage",
      subtitle: `${counts.files} files · ${counts.folders} folders`,
      icon: HardDrive,
      path: "/storage",
    },
    {
      title: "Share Files",
      subtitle: "Send encrypted files by email",
      icon: Send,
      path: "/share",
    },
    {
      title: "Shared With Me",
      subtitle: "Files others sent you",
      icon: Inbox,
      path: "/shared-with-me",
    },
    {
      title: "Recovery & Access",
      subtitle: "Recovery phrase & sharing keys",
      icon: Key,
      path: "/recovery-access",
    },
    ...(canReadAnalytics
      ? [
          {
            title: "Analytics",
            subtitle: "Private aggregate operator metrics",
            icon: BarChart3,
            path: "/admin/analytics",
          },
        ]
      : []),
  ];

  return (
    <div className="container mx-auto w-full relative min-h-screen bg-background text-foreground">
      {/* Header (landing-page style) — brand left, account controls right */}
      <header className="flex h-[10vh] border-b justify-between pt-5 items-center gap-4 px-10 lg:px-10">
        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-2 bg-transparent p-0"
        >
          <span className="text-lg font-semibold">ZeroDrive</span>
        </button>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/shahadpichen/zerodrive"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm font-medium hover:underline sm:inline-block"
          >
            Star on GitHub
          </a>
          <ModeToggle />
          {userEmail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Account menu" className="rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback>
                      {initials(userName, userEmail)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-0.5">
                    <span className="text-sm font-medium">
                      {userName || userEmail}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {storageInfo && (
                  <>
                    <div className="px-2 py-2">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Storage used
                        </span>
                        <span>
                          {formatBytes(storageInfo.used)} /{" "}
                          {formatBytes(storageInfo.total)}
                        </span>
                      </div>
                      <Progress value={usagePercentage} className="h-1.5" />
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 sm:px-8 mt-20">
        {/* Welcome — centered, matching the landing hero type scale */}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl md:w-[70%] mx-auto">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-light leading-relaxed">
            {tip}
          </p>
        </div>

        {/* Navigation — the four destinations, uniform cards in a grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => navigate(card.path)}
                className="flex items-center gap-4 border p-5 text-left transition-colors hover:bg-muted/50"
              >
                <Icon className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{card.title}</div>
                  <div className="truncate text-xs font-light text-muted-foreground">
                    {card.subtitle}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        {/* Recent + security */}
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="border">
            <div className="flex items-center justify-between border-b px-5 py-3.5 text-sm font-medium">
              <span>Recent files</span>
              <button
                onClick={() => navigate("/storage")}
                className="text-xs text-[#3182ce] hover:underline"
              >
                View all →
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                No files yet.
              </p>
            ) : (
              recent.map((file) => (
                <button
                  key={file.id}
                  onClick={() => navigate("/storage")}
                  className="flex w-full items-center gap-3 border-b px-5 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <img
                    src={getFileIconPath(file.mimeType)}
                    alt=""
                    className="h-5 w-5 flex-shrink-0"
                  />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(file.uploadedDate).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border">
            <div className="border-b px-5 py-3.5 text-sm font-medium">
              Security &amp; setup
            </div>
            <div className="flex items-start gap-2.5 border-b px-5 py-3.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <div>
                End-to-end encryption active
                <div className="mt-0.5 text-[11.5px] font-light text-muted-foreground">
                  Files are encrypted on your device before upload.
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/recovery-access")}
              className="flex w-full items-start gap-2.5 px-5 py-3.5 text-left text-sm hover:bg-muted/50"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div>
                Back up your recovery phrase
                <div className="mt-0.5 text-[11.5px] font-light text-muted-foreground">
                  Lose it and no one can recover your files.{" "}
                  <span className="text-[#3182ce]">Review →</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}

export default Home;
