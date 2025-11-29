import React, { useState, useEffect } from "react";
import { gapi } from "gapi-script";
import { FileList } from "../components/storage/file-list";
import { ModeToggle } from "../components/mode-toggle";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

import { getStoredKey } from "../utils/cryptoUtils";
import {
  getAllFilesForUser,
  fetchAndStoreFileMetadata,
} from "../utils/dexieDB";
import {
  uploadAndSyncFile,
  deleteAllAndSyncFiles,
} from "../utils/fileOperations";
import { ConfirmationDialog } from "../components/storage/confirmation-dialog";
import Footer from "../components/landing-page/footer";
import { Separator } from "../components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Progress } from "../components/ui/progress";
import { Zap, Coins } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

// Imports for sharing key functionality
import {
  generateUserKeyPair,
  storeUserPublicKey,
  hashEmail,
} from "../utils/fileSharing";
import { storeUserKeyPair, deleteUserKeyPair } from "../utils/keyStorage";
import { encryptRsaPrivateKeyWithAesKey } from "../utils/rsaKeyManager";
import { uploadEncryptedRsaKeyToDrive } from "../utils/gdriveKeyStorage";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";
import apiClient from "../utils/apiClient";

function PrivateStorage() {
  const navigate = useNavigate();
  const [_isAuthenticated, setIsAuthenticated] = useState(true);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userImage, setUserImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);
  const [userHasFiles, setUserHasFiles] = useState<boolean>(false);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState<boolean>(true);
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    total: number;
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState<boolean>(true);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean>(true);
  const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);

  // State for sharing key feature
  const [hasSharingKeys, setHasSharingKeys] = useState<boolean>(false);
  const [isProcessingSharingKeys, setIsProcessingSharingKeys] =
    useState<boolean>(false);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage < 60) return "hsl(142.1 76.2% 36.3%)";
    if (percentage < 75) return "hsl(47.9 95.8% 53.1%)";
    return "hsl(0 84.2% 60.2%)";
  };

  const loadStorageInfo = async (email?: string) => {
    setIsLoadingStorage(true);
    try {
      // Get Google access token from sessionStorage
      const { getOrFetchGoogleToken } = await import("../utils/authService");
      const token = await getOrFetchGoogleToken();

      if (!token) {
        console.warn(
          "[StorageInfo] No Google token available, cannot fetch storage."
        );
        setStorageInfo(null);
        setIsLoadingStorage(false);
        return;
      }

      const response = await gapi.client.request({
        path: "https://www.googleapis.com/drive/v3/about",
        params: { fields: "storageQuota" },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.result.storageQuota) {
        const { storageQuota } = response.result;
        setStorageInfo({
          used: parseInt(storageQuota.usage || "0", 10),
          total: parseInt(storageQuota.limit || "0", 10),
        });
      } else {
        setStorageInfo(null);
      }

      // Fetch credit balance
      try {
        const emailToUse = email || userEmail;
        if (emailToUse) {
          const hashedEmail = await hashEmail(emailToUse);
          const balanceData = await apiClient.credits.getBalance(hashedEmail);
          setCreditBalance(balanceData.balance);
        }
      } catch (creditError) {
        console.error(
          "[StorageInfo] Error fetching credit balance:",
          creditError
        );
        // Don't fail the whole function if credits fail to load
      }
    } catch (error) {
      console.error("[StorageInfo] Error loading storage info:", error);
      setStorageInfo(null);
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingUserFiles(true);
      setIsLoadingStorage(true);
      try {
        // Get user info from JWT first
        const { getUserEmail } = await import("../utils/authService");
        const email = await getUserEmail();

        if (!email) {
          console.error("No user email found in JWT");
          toast.error("Authentication error", {
            description: "No user information found. Please sign in again.",
          });
          // Clear auth and redirect
          const { logout } = await import("../utils/authService");
          await logout();
          window.location.href = "/";
          return;
        }

        // Account switch detection
        const { getSessionUser, setSessionUser, clearSession } = await import(
          "../utils/sessionManager"
        );
        const sessionEmail = getSessionUser();

        if (sessionEmail && sessionEmail !== email) {
          console.warn(`Account switch detected: ${sessionEmail} -> ${email}`);
          clearSession();
          setSessionUser(email);
          window.location.reload();
          return;
        }

        if (!sessionEmail) {
          setSessionUser(email);
        }

        // Set user info (no name/image from JWT, just email)
        setUserEmail(email);
        setUserName(email.split("@")[0]); // Use email prefix as name for now

        // Check if Google tokens exist in sessionStorage before initializing GAPI
        const { hasGoogleTokensInStorage, logout } = await import(
          "../utils/authService"
        );
        const tokensExist = hasGoogleTokensInStorage();

        if (!tokensExist) {
          console.warn(
            "[Storage] Google tokens not found in sessionStorage - redirecting to re-authenticate"
          );
          // Automatically logout and redirect to login to get fresh tokens
          await logout();
          window.location.href = "/";
          return;
        }

        // Initialize Google API with backend tokens
        const { initializeGapi } = await import("../utils/gapiInit");

        try {
          await initializeGapi();
        } catch (gapiError) {
          console.error("Failed to initialize Google API:", gapiError);
          toast.error("Google Drive connection failed", {
            description:
              "Could not connect to Google Drive. Try signing out and back in to reconnect.",
            duration: 10000,
            action: {
              label: "Sign Out",
              onClick: async () => {
                const { logout } = await import("../utils/authService");
                await logout();
                window.location.href = "/";
              },
            },
          });
          // Don't redirect - let user stay on page with error state
          setIsLoadingUserFiles(false);
          setIsLoadingStorage(false);
          return;
        }

        // Load user files and storage
        await fetchAndStoreFileMetadata();
        const files = await getAllFilesForUser(email);
        setUserHasFiles(files.length > 0);
        await loadStorageInfo(email);

        // Check for sharing keys and attempt recovery if needed
        const result = await recoverRsaKeysIfNeeded(email, false);
        setHasSharingKeys(result.keysExisted || result.recovered);
      } catch (error) {
        console.error("Error loading user info or storage:", error);
        toast.error("Failed to load storage", {
          description:
            "An error occurred while loading your storage. Please try refreshing the page.",
        });
        // Don't automatically redirect - stay on page with error
      } finally {
        setIsLoadingUserFiles(false);
        setIsLoadingStorage(false);
      }
    };

    loadInitialData();

    const intervalId = setInterval(loadStorageInfo, 60 * 1000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (userEmail) {
      setIsLoadingUserFiles(true);
      getAllFilesForUser(userEmail)
        .then((files) => {
          setUserHasFiles(files.length > 0);
        })
        .catch((err) => {
          console.error("Error checking user files:", err);
          setUserHasFiles(false);
        })
        .finally(() => setIsLoadingUserFiles(false));
      // Also re-check sharing keys if userEmail changes (though less likely here)
      recoverRsaKeysIfNeeded(userEmail, false).then((result) => {
        setHasSharingKeys(result.keysExisted || result.recovered);
      });
    }
  }, [userEmail, refreshFileListKey]);

  const handleLogout = async () => {
    try {
      const { clearSession } = await import("../utils/sessionManager");
      const { logout } = await import("../utils/authService");

      // Call auth service logout (clears cookies, localStorage, sessionStorage)
      await logout();
      clearSession();

      console.log("Logout complete - redirecting to home");

      // Use replace() to prevent back button issues
      // Longer timeout to ensure cookies are fully cleared before redirect
      setTimeout(() => {
        console.log("[Logout Handler] Redirecting to home page");
        window.location.replace("/");
      }, 500);
    } catch (error) {
      console.error("Error during logout:", error);
      // Redirect anyway on error
      window.location.replace("/");
    }
  };

  const handleRefreshFiles = async () => {
    if (!userEmail) {
      toast.error("User information not available to refresh files.");
      return;
    }
    setIsRefreshingFiles(true);
    const refreshToastId = toast.loading("Refreshing file list...");
    try {
      await fetchAndStoreFileMetadata();
      const files = await getAllFilesForUser(userEmail);
      setUserHasFiles(files.length > 0);
      setRefreshFileListKey((prev) => prev + 1);
      toast.success("File list refreshed successfully.", {
        id: refreshToastId,
      });
    } catch (error: any) {
      console.error("Error refreshing files:", error);
      toast.error("Failed to refresh file list.", {
        description: error.message || "Could not sync with Google Drive.",
        id: refreshToastId,
      });
    } finally {
      setIsRefreshingFiles(false);
    }
  };

  const handleUploadTrigger = async () => {
    const key = await getStoredKey();
    if (!key) {
      toast.error("No encryption key found", {
        description: "Please generate or upload an encryption key",
      });
      setShowKeyModal(true);
      setHasEncryptionKey(false);
      return;
    }
    setHasEncryptionKey(true);
    document.getElementById("file-upload")?.click();
  };

  const handleFileChangeAndUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0 || !userEmail) return;

    const filesToUpload = Array.from(e.target.files);
    e.target.value = "";

    setUploading(true);
    let successCount = 0;

    for (const file of filesToUpload) {
      const result = await uploadAndSyncFile(file, userEmail);
      if (result) successCount++;
    }

    setUploading(false);

    if (successCount > 0) {
      setRefreshFileListKey((prev) => prev + 1);
      setUserHasFiles(true);
    } else if (filesToUpload.length > 0) {
      // Optional: Show a summary error if *all* failed
      // toast.error("All file uploads failed.");
    }
  };

  const performDeleteAllFiles = async () => {
    if (!userEmail) return;

    // Check for encryption key before allowing deletion
    const key = await getStoredKey();
    if (!key) {
      toast.error("Encryption key required", {
        description:
          "You need your encryption key to delete files. Please upload it first.",
      });
      setShowDeleteConfirm(false);
      return;
    }

    setIsDeleting(true);
    const success = await deleteAllAndSyncFiles(userEmail);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    if (success) {
      setRefreshFileListKey((prev) => prev + 1);
      setUserHasFiles(false);
    }
  };

  const handleDeleteAllFiles = () => {
    if (!userEmail) return;
    setShowDeleteConfirm(true);
  };

  const rollbackKeyGeneration = async (email: string) => {
    try {
      console.log("Rolling back key generation for:", email);
      await deleteUserKeyPair(email);
      const hashedEmail = await hashEmail(email);
      await apiClient.publicKeys.delete(hashedEmail);
      console.log(
        "Rollback completed: keys deleted from all storage locations"
      );
    } catch (error) {
      console.error("Error during rollback:", error);
    }
  };

  const handleEnableFileSharing = async () => {
    if (!userEmail) {
      toast.error("User email not available. Cannot enable sharing.");
      return;
    }

    setIsProcessingSharingKeys(true);
    const genToastId = toast.loading("Checking for primary encryption key...");

    try {
      // 1. Check for primary encryption key
      const primaryAesKey = await getStoredKey();

      // If no AES key, redirect to key management
      if (!primaryAesKey) {
        toast.dismiss(genToastId);
        toast.info("Encryption key required", {
          description: "Please enter your mnemonic first to use file sharing.",
        });
        navigate("/key-management");
        setIsProcessingSharingKeys(false);
        return;
      }

      // 2. Generate key pair
      toast.loading("Generating your sharing keys...", { id: genToastId });
      const keyPair = await generateUserKeyPair();

      // 3. Store in PostgreSQL
      const hashedEmail = await hashEmail(userEmail);
      await storeUserPublicKey(hashedEmail, keyPair.publicKeyJwk);

      // 4. Store in IndexedDB (encrypted with mnemonic)
      const { getMnemonic } = await import("../utils/mnemonicManager");
      const mnemonic = getMnemonic();

      if (!mnemonic) {
        throw new Error("Mnemonic not available - cannot encrypt RSA keys");
      }

      await storeUserKeyPair(userEmail, keyPair, mnemonic);

      // 5. Backup to Google Drive (MANDATORY - rollback if fails)
      if (!keyPair.privateKeyJwk) {
        throw new Error("Private key not generated properly");
      }

      toast.loading("Backing up sharing private key to Google Drive...", {
        id: genToastId,
      });

      try {
        const encryptedPrivateKeyBlob = await encryptRsaPrivateKeyWithAesKey(
          keyPair.privateKeyJwk,
          primaryAesKey
        );

        await uploadEncryptedRsaKeyToDrive(encryptedPrivateKeyBlob);

        // ✅ SUCCESS - Everything worked!
        setHasSharingKeys(true);
        toast.success("Sharing keys generated and backed up to Drive", {
          id: genToastId,
        });
      } catch (backupError) {
        // ❌ BACKUP FAILED - Rollback everything
        console.error("Backup failed, rolling back:", backupError);
        toast.loading("Backup failed - cleaning up...", { id: genToastId });

        await rollbackKeyGeneration(userEmail);

        toast.error("Key generation cancelled due to backup failure", {
          description:
            backupError instanceof Error
              ? backupError.message
              : "Could not backup to Google Drive. Please check connection and try again.",
          id: genToastId,
          duration: 8000,
        });
        setIsProcessingSharingKeys(false);
        return;
      }
    } catch (error) {
      console.error("Error during sharing key generation process:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to generate sharing keys", {
        description: errorMessage,
        id: genToastId,
      });
    } finally {
      setIsProcessingSharingKeys(false);
    }
  };

  const usagePercentage = storageInfo
    ? storageInfo.total > 0
      ? (storageInfo.used / storageInfo.total) * 100
      : 0
    : 0;

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center bg-background text-foreground">
      <header className="flex h-[10vh] w-full border-b justify-between pt-5 items-center gap-4 px-10 lg:px-10">
        <span className="font-semibold text-base sm:text-lg">ZeroDrive</span>
        <div className="flex items-center gap-3 sm:gap-6">
          {creditBalance !== null && (
            <div className="hidden md:flex items-center gap-1.5">
              <Coins
                className={
                  creditBalance < 1
                    ? "text-red-600"
                    : creditBalance < 3
                    ? "text-amber-600"
                    : "text-green-600"
                }
                size={16}
              />
              <span
                className={`text-xs font-semibold ${
                  creditBalance < 1
                    ? "text-red-600"
                    : creditBalance < 3
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {creditBalance.toFixed(1)}
              </span>
            </div>
          )}
          <input
            type="file"
            id="file-upload"
            multiple
            className="hidden"
            onChange={handleFileChangeAndUpload}
            disabled={uploading}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs sm:text-sm px-2 sm:px-3"
          >
            {userName ? `Logout (${userName.split(" ")[0]})` : "Logout"}
          </Button>
          <ModeToggle />
        </div>
      </header>
      <main className="md:w-[70%] flex flex-col space-y-6 py-6 sm:py-8 px-4 sm:px-6 flex-grow">
        {!isLoadingUserFiles && userHasFiles ? (
          <>
            <p className="text-sm text-muted-foreground">
              Manage your key first. Upload to encrypt files to Drive.{" "}
              <span className="text-foreground">
                Click file names below to download
              </span>{" "}
              and decrypt them (requires your key).
            </p>
            <Separator className="w-full" />
          </>
        ) : !isLoadingUserFiles ? (
          <p className="text-sm text-muted-foreground">
            No files uploaded yet. Use 'Upload Files' in Quick Actions.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Loading file status...
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="col-span-2">
            <div className="flex items-center mb-3">
              <h2 className="text-base sm:text-lg font-mono font-normal">
                Your Files
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshFiles}
                disabled={isRefreshingFiles || isLoadingUserFiles}
                className="ml-2 h-7 w-7"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isRefreshingFiles ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
            <FileList
              view="compact"
              refreshKey={refreshFileListKey}
              userEmail={userEmail}
            />
          </div>

          <div className="col-span-1 flex flex-col items-start md:items-end">
            <h2 className="text-base sm:text-lg mb-3 font-mono font-normal">
              Quick Actions
            </h2>
            <div className="flex flex-col space-y-2 items-end w-full">
              <Button
                variant="ghost"
                className="justify-start md:justify-end px-1 h-auto py-1 text-sm"
                onClick={handleUploadTrigger}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload Files"}
              </Button>

              <Button
                variant="ghost"
                className="justify-start md:justify-end px-1 h-auto py-1 text-sm"
                onClick={async () => {
                  // Check if AES key exists in sessionStorage
                  const aesKey = await getStoredKey();

                  if (aesKey) {
                    navigate("/share"); // Has key, can proceed
                  } else {
                    // No key, redirect to key management
                    toast.info("Encryption key required", {
                      description:
                        "Please enter your mnemonic first to use file sharing.",
                    });
                    navigate("/key-management");
                  }
                }}
              >
                Share Files Page (Send)
              </Button>

              <Button
                variant="ghost"
                className="justify-start md:justify-end px-1 h-auto py-1 text-sm"
                onClick={async () => {
                  // Check if AES key exists in sessionStorage
                  const aesKey = await getStoredKey();

                  if (aesKey) {
                    navigate("/shared-with-me"); // Has key, can proceed
                  } else {
                    // No key, redirect to key management
                    toast.info("Encryption key required", {
                      description:
                        "Please enter your mnemonic first to use file sharing.",
                    });
                    navigate("/key-management");
                  }
                }}
              >
                Shared with Me (Receive)
              </Button>

              <Button
                variant="ghost"
                className="justify-start md:justify-end px-1 h-auto py-1 text-sm"
                onClick={handleEnableFileSharing}
                disabled={isProcessingSharingKeys || hasSharingKeys}
              >
                {isProcessingSharingKeys
                  ? "Processing..."
                  : hasSharingKeys
                  ? "File Sharing Enabled"
                  : "Enable File Sharing/Receiving"}
              </Button>

              <Link to="/key-management">
                <Button
                  variant="ghost"
                  className="justify-start md:justify-end px-1 h-auto py-1 text-sm"
                >
                  Manage Encryption Keys
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-fit justify-end px-1 h-auto py-1 text-sm"
                    disabled={isLoadingStorage || !storageInfo}
                  >
                    {isLoadingStorage
                      ? "Loading Storage..."
                      : "View Storage Usage"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-4">
                  {storageInfo ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center w-full">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Zap className="text-green-600" size={16} />
                          Storage
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(storageInfo.used)} /{" "}
                          {formatBytes(storageInfo.total)}
                        </span>
                      </div>
                      <Progress
                        value={usagePercentage}
                        className="h-2"
                        style={{
                          ["--progress-background" as string]:
                            getProgressColor(usagePercentage),
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      Could not load storage info.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                className="justify-start md:justify-end px-1 h-auto py-1 text-sm text-destructive hover:text-destructive/80"
                onClick={handleDeleteAllFiles}
                disabled={isDeleting || !userHasFiles}
              >
                {isDeleting ? "Deleting All Files..." : "Delete All Files"}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <footer className="container mx-auto text-center text-sm border-t py-5 mt-5">
        <p>
          &copy; ZeroDrive - A platform for secure file storage on Google Drive.
        </p>
      </footer>
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete All Files?"
        description="Are you sure you want to delete ALL files? This action cannot be undone."
        onConfirm={performDeleteAllFiles}
        confirmText={isDeleting ? "Deleting..." : "Delete All"}
      />
    </div>
  );
}

export default PrivateStorage;
