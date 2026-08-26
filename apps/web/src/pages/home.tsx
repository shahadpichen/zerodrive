import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HardDrive,
  Send,
  Inbox,
  Key,
  ChevronRight,
  Check,
  LogOut,
  BarChart3,
} from "lucide-react";
import { useApp } from "../contexts/app-context";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { getFileIconPath } from "../lib/mime-types";
import {
  FileMeta,
  getAllFilesForUser,
  getFoldersForUser,
  fetchAndStoreFileMetadata,
} from "../utils/dexieDB";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";
import {
  getAuthenticatedUser,
  hasGoogleTokensInStorage,
  logout,
} from "../utils/authService";
import { initializeGapi } from "../utils/gapiInit";
import {
  dismissOnboardingGuidance,
  getVaultSetupState,
  readBrowserVaultSetupSnapshot,
} from "../utils/vaultSetupState";
import type { VaultSetupState } from "../utils/vaultSetupState";
import {
  hasPendingHomeLoginWelcome,
  markHomeLoginWelcomeShown,
} from "../utils/homeWelcome";
import {
  readCachedHomeDashboardForUser,
  writeCachedHomeDashboard,
} from "../utils/homeDashboardCache";
import { useVaultData } from "../contexts/vault-data-context";
import { LegalAcceptanceReminder } from "../components/legal-acceptance-gate";
import { GoogleDrivePermissionReminder } from "../components/google-drive-permission-gate";

type LockedSharingDestination = "share" | "inbox";

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
  const {
    replaceVaultData,
    setVaultMetadataStatus,
    clearVaultData,
    state: sharedVaultState,
  } = useVaultData();

  const [showLoginWelcome] = useState(() => hasPendingHomeLoginWelcome());
  const hasWarmVaultState =
    !!userEmail &&
    sharedVaultState.userEmail === userEmail.trim().toLowerCase() &&
    sharedVaultState.hasVaultKey !== null &&
    sharedVaultState.lastSyncedAt !== null;
  const initialCachedDashboard =
    hasWarmVaultState && !showLoginWelcome
      ? readCachedHomeDashboardForUser(userEmail)
      : null;
  const warmVaultSetup = hasWarmVaultState
    ? (initialCachedDashboard?.vaultSetup ?? {
        ...getVaultSetupState({
          isAuthenticated: true,
          hasGoogleTokens: hasGoogleTokensInStorage(),
          hasPrimaryKey: !!sharedVaultState.hasVaultKey,
          hasRecoveryPhrase: false,
          fileCount: sharedVaultState.files.length,
          folderCount: sharedVaultState.folders.length,
          hasSharingKeys: false,
          hasDecryptionError:
            sharedVaultState.metadataStatus === "decryption_error",
          guidanceDismissed: true,
        }),
        tasks: [],
        shouldShowGuidance: false,
      })
    : null;
  const [counts, setCounts] = useState(
    () =>
      initialCachedDashboard?.counts ??
      (hasWarmVaultState
        ? {
            files: sharedVaultState.files.length,
            folders: sharedVaultState.folders.length,
          }
        : { files: 0, folders: 0 }),
  );
  const [recent, setRecent] = useState<FileMeta[]>(
    () =>
      initialCachedDashboard?.recent ??
      (hasWarmVaultState
        ? [...sharedVaultState.files]
            .sort(
              (a, b) =>
                new Date(b.uploadedDate).getTime() -
                new Date(a.uploadedDate).getTime(),
            )
            .slice(0, 5)
        : []),
  );
  const [canReadAnalytics, setCanReadAnalytics] = useState(
    initialCachedDashboard?.canReadAnalytics ?? false,
  );
  const [vaultSetup, setVaultSetup] = useState<VaultSetupState | null>(
    warmVaultSetup,
  );
  const [isVaultStateLoading, setIsVaultStateLoading] =
    useState(!warmVaultSetup);
  const [lockedSharingDestination, setLockedSharingDestination] =
    useState<LockedSharingDestination | null>(null);

  useEffect(() => {
    if (showLoginWelcome) {
      markHomeLoginWelcomeShown();
    }
  }, [showLoginWelcome]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const authenticatedUser = await getAuthenticatedUser();
        const email = authenticatedUser?.email;
        if (!email) {
          await logout();
          window.location.href = "/";
          return;
        }

        // Establish the authenticated account before any Drive work so the
        // shared vault provider can hydrate its account-scoped IndexedDB data.
        setUserInfo(email, email.split("@")[0]);

        const nextCanReadAnalytics =
          !!authenticatedUser?.capabilities.analyticsRead;
        setCanReadAnalytics(nextCanReadAnalytics);

        if (!hasGoogleTokensInStorage()) {
          await logout();
          window.location.href = "/";
          return;
        }

        if (!showLoginWelcome && isMounted) {
          const cachedDashboard = readCachedHomeDashboardForUser(email);
          if (cachedDashboard) {
            setCounts(cachedDashboard.counts);
            setRecent(cachedDashboard.recent);
            setVaultSetup(cachedDashboard.vaultSetup);
            setIsVaultStateLoading(false);
          }
        }

        try {
          await initializeGapi();
        } catch (e) {
          console.error("Failed to initialize Google API:", e);
          return;
        }

        let hasMetadataDecryptionError = false;
        let metadataStatus: "ready" | "decryption_error" | "error" = "ready";
        setVaultMetadataStatus(email, "verifying");
        try {
          await fetchAndStoreFileMetadata();
          setDecryptionError(false);
        } catch (err: any) {
          if (err?.name === "DecryptionError") {
            hasMetadataDecryptionError = true;
            metadataStatus = "decryption_error";
            setDecryptionError(true);
          } else {
            metadataStatus = "error";
          }
        }

        const [files, folders] = await Promise.all([
          getAllFilesForUser(email),
          getFoldersForUser(email),
        ]);
        replaceVaultData(email, files, folders, { metadataStatus });
        const nextCounts = { files: files.length, folders: folders.length };
        const nextRecent = [...files]
          .sort(
            (a, b) =>
              new Date(b.uploadedDate).getTime() -
              new Date(a.uploadedDate).getTime(),
          )
          .slice(0, 5);
        setCounts(nextCounts);
        setRecent(nextRecent);

        const rsaRecovery = await recoverRsaKeysIfNeeded(email);
        const setupSnapshot = await readBrowserVaultSetupSnapshot(email, {
          isAuthenticated: true,
          hasGoogleTokens: true,
          fileCount: files.length,
          folderCount: folders.length,
          hasDecryptionError: hasMetadataDecryptionError,
        });
        const nextVaultSetup = getVaultSetupState({
          ...setupSnapshot,
          hasSharingKeys:
            setupSnapshot.hasSharingKeys || rsaRecovery.keysExisted,
          guidanceDismissed: setupSnapshot.guidanceDismissed,
        });
        setVaultSetup(nextVaultSetup);
        writeCachedHomeDashboard({
          userEmail: email,
          counts: nextCounts,
          recent: nextRecent,
          canReadAnalytics: nextCanReadAnalytics,
          vaultSetup: nextVaultSetup,
        });
      } catch (error) {
        console.error("[Home] Failed to load dashboard:", error);
      } finally {
        if (isMounted) {
          setIsVaultStateLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [
    replaceVaultData,
    setDecryptionError,
    setUserInfo,
    setVaultMetadataStatus,
    showLoginWelcome,
  ]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("zerodrive-storage-cache");
      clearVaultData();
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
  const fallbackHeadline = `Welcome back${firstName ? `, ${firstName}` : ""}`;
  const isWaitingForVaultState = isVaultStateLoading;
  const heroHeadline = showLoginWelcome
    ? fallbackHeadline
    : isWaitingForVaultState
      ? "Setting up your private vault"
      : vaultSetup?.headline || "Could not check your vault";
  const heroDescription = isWaitingForVaultState
    ? "Checking this browser for your encryption key, Drive access, and vault contents."
    : vaultSetup?.description ||
      "ZeroDrive could not finish checking Google Drive in this browser. Refresh the page or reconnect Google Drive, then try again.";
  const showVaultGuidance = !!vaultSetup?.shouldShowGuidance;
  const incompleteTasks =
    vaultSetup?.tasks.filter((task) => !task.complete) || [];
  const nextTask = incompleteTasks.find((task) => !task.optional);
  const sharingTask = vaultSetup?.tasks.find((task) => task.id === "sharing");
  const isSharingIdentityActive = !!sharingTask?.complete;
  const hasVaultAccess = vaultSetup
    ? vaultSetup.status !== "needs_key"
    : hasWarmVaultState && !!sharedVaultState.hasVaultKey;
  const shouldHoldSharingDestinations = isVaultStateLoading || !hasVaultAccess;
  const shouldGateSharingDestinations = !isVaultStateLoading && !hasVaultAccess;

  const sharingDestinationPath = (destination: LockedSharingDestination) =>
    destination === "inbox" ? "/shared-with-me" : "/share";

  const handleDismissGuidance = () => {
    dismissOnboardingGuidance();
    if (vaultSetup) {
      setVaultSetup({ ...vaultSetup, shouldShowGuidance: false });
    }
  };

  const navCards = [
    {
      title: "Storage",
      subtitle: `${counts.files} files · ${counts.folders} folders`,
      icon: HardDrive,
      path: "/storage",
    },
    {
      title: "Share Files",
      subtitle: isVaultStateLoading
        ? "Checking access"
        : shouldGateSharingDestinations
          ? "Set up access first"
          : "Send encrypted files by email",
      icon: Send,
      path: "/share",
      lockedDestination: "share" as const,
    },
    {
      title: "Shared With Me",
      subtitle: isVaultStateLoading
        ? "Checking access"
        : shouldGateSharingDestinations
          ? "Set up access first"
          : "Files others sent you",
      icon: Inbox,
      path: "/shared-with-me",
      lockedDestination: "inbox" as const,
    },
    {
      title: "Recovery & Access",
      subtitle: "Recovery phrase & sharing keys",
      icon: Key,
      path: "/recovery-access?returnTo=%2Fhome",
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
  const lockedDialogCopy = isVaultStateLoading
    ? {
        title: "Checking Recovery & Access",
        description:
          "ZeroDrive is checking whether this session already has the recovery key needed for sharing.",
        returnTo: sharingDestinationPath(lockedSharingDestination || "share"),
      }
    : lockedSharingDestination === "inbox"
      ? {
          title: "Set up Recovery & Access first",
          description:
            "Create or enter your recovery phrase so ZeroDrive can open shared files locally or save encrypted copies to Storage. After that, ZeroDrive will bring you back here.",
          returnTo: "/shared-with-me",
        }
      : {
          title: "Set up Recovery & Access first",
          description:
            "Create or enter your recovery phrase so ZeroDrive can encrypt files locally for the recipient. After that, ZeroDrive will bring you back here.",
          returnTo: "/share",
        };

  useEffect(() => {
    if (!lockedSharingDestination || isVaultStateLoading || !hasVaultAccess) {
      return;
    }

    const destination = sharingDestinationPath(lockedSharingDestination);
    setLockedSharingDestination(null);
    navigate(destination);
  }, [hasVaultAccess, isVaultStateLoading, lockedSharingDestination, navigate]);

  const openSharingDestination = (destination: LockedSharingDestination) => {
    if (shouldHoldSharingDestinations) {
      setLockedSharingDestination(destination);
      return;
    }

    navigate(sharingDestinationPath(destination));
  };

  const openNavCard = (card: (typeof navCards)[number]) => {
    if (
      card.lockedDestination &&
      (card.lockedDestination === "share" || card.lockedDestination === "inbox")
    ) {
      openSharingDestination(card.lockedDestination);
      return;
    }
    navigate(card.path);
  };

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
            href="https://github.com/zerodrivehq/zerodrive"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm font-medium hover:underline sm:inline-block"
          >
            Star on GitHub
          </a>
          <GoogleDrivePermissionReminder className="hidden sm:inline-flex" />
          <LegalAcceptanceReminder className="hidden sm:inline-flex" />
          <ModeToggle />
          {userEmail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Account menu" className="rounded-full">
                  <Avatar className="h-9 w-9">
                    {userImage && (
                      <AvatarImage
                        src={userImage}
                        alt={userName || userEmail}
                      />
                    )}
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

      <div className="mx-auto mt-20 max-w-5xl px-6 pb-20 sm:px-8">
        {/* Welcome — centered, matching the landing hero type scale */}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl md:w-[70%] mx-auto">
            {heroHeadline}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-light leading-relaxed">
            {heroDescription}
          </p>
        </div>

        {showVaultGuidance && vaultSetup && (
          <div className="mt-8 border text-left">
            <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex border px-2.5 py-1 text-xs font-semibold">
                  {vaultSetup.badge}
                </div>
                <h2 className="mt-4 text-xl tracking-tight">
                  {nextTask
                    ? "Your next step is clear"
                    : "Your vault setup is almost complete"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-muted-foreground">
                  {nextTask
                    ? nextTask.description
                    : "You can keep using ZeroDrive now. Secure sharing is optional and can be created when you need it."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:min-w-56">
                <button
                  onClick={() => navigate(vaultSetup.primaryActionPath)}
                  className="border bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {vaultSetup.primaryActionLabel}
                </button>
                {vaultSetup.status !== "needs_key" && (
                  <button
                    onClick={handleDismissGuidance}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Hide setup guidance
                  </button>
                )}
              </div>
            </div>
            <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {vaultSetup.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => task.actionPath && navigate(task.actionPath)}
                  className="flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center border text-xs ${
                      task.complete
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    {task.complete ? <Check className="h-4 w-4" /> : "•"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {task.label}
                      {task.optional && (
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          optional
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs font-light leading-relaxed text-muted-foreground">
                      {task.description}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation — the four destinations, uniform cards in a grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {navCards.map((card) => {
            const Icon = card.icon;
            const isSoftLocked =
              !!card.lockedDestination && shouldHoldSharingDestinations;
            return (
              <button
                key={card.title}
                onClick={() => openNavCard(card)}
                className="flex items-center gap-4 border p-5 text-left transition-colors hover:bg-muted/50"
              >
                <Icon className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-semibold">
                    {card.title}
                    {isSoftLocked && (
                      <span className="border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {isVaultStateLoading ? "checking" : "locked"}
                      </span>
                    )}
                  </div>
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
                className="text-xs text-[hsl(var(--link))] hover:underline"
              >
                View all →
              </button>
            </div>
            {recent.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-semibold">
                  Your vault is waiting for its first encrypted file.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs font-light leading-relaxed text-muted-foreground">
                  Upload from Storage and your browser encrypts the file before
                  it is stored.
                </p>
                <button
                  onClick={() => navigate("/storage")}
                  className="mt-4 border px-4 py-2 text-sm font-semibold hover:bg-muted/50"
                >
                  Upload first file
                </button>
              </div>
            ) : (
              recent.map((file) => (
                <button
                  key={file.id}
                  onClick={() => navigate("/storage")}
                  className="flex w-full items-center gap-3 border-b px-5 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <img
                    src={getFileIconPath(file.mimeType, file.name)}
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
            <div className="flex items-start gap-2.5 border-b px-5 py-3.5 text-sm">
              <Key className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                Recovery phrase reminder
                <div className="mt-0.5 text-[11.5px] font-light text-muted-foreground">
                  Keep it saved offline. ZeroDrive cannot reset it.
                </div>
              </div>
            </div>
            <button
              onClick={() => openSharingDestination("share")}
              className="flex w-full items-start gap-2.5 px-5 py-3.5 text-left text-sm hover:bg-muted/50"
            >
              {isSharingIdentityActive ? (
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              ) : (
                <Send className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <div>
                {isSharingIdentityActive
                  ? "Sharing identity active"
                  : "Create sharing identity"}
                <div className="mt-0.5 text-[11.5px] font-light text-muted-foreground">
                  {isSharingIdentityActive
                    ? "Ready to send and receive private shares."
                    : "Needed for private shared files."}{" "}
                  <span className="text-[hsl(var(--link))]">
                    {isSharingIdentityActive ? "Share →" : "Set up →"}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      <Dialog
        open={!!lockedSharingDestination}
        onOpenChange={(open) => {
          if (!open) setLockedSharingDestination(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lockedDialogCopy.title}</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {lockedDialogCopy.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setLockedSharingDestination(null)}
              className="border px-4 py-2 text-sm font-semibold hover:bg-muted/50"
            >
              Not now
            </button>
            <button
              type="button"
              disabled={isVaultStateLoading}
              onClick={() => {
                if (isVaultStateLoading) return;
                navigate(
                  `/recovery-access?returnTo=${encodeURIComponent(
                    lockedDialogCopy.returnTo,
                  )}`,
                );
              }}
              className="border bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVaultStateLoading ? "Checking..." : "Set up access"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Home() {
  return <HomeContent />;
}

export default Home;
