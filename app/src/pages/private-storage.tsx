import React, { useState, useEffect } from "react";
import { FileList } from "../components/storage/file-list";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { useApp } from "../contexts/app-context";

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
import { Separator } from "../components/ui/separator";
import { RefreshCw } from "lucide-react";

// Imports for sharing key functionality (kept for potential future use)
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";

function PrivateStorage() {
  const { userEmail, setUserInfo, refreshAll, setDecryptionError } = useApp();
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);
  const [userHasFiles, setUserHasFiles] = useState<boolean>(false);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState<boolean>(true);
  const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingUserFiles(true);
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
        const { getSessionUser, setSessionUser, clearSession } =
          await import("../utils/sessionManager");
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

        // Initialize GAPI first so we can fetch profile info
        const { hasGoogleTokensInStorage, logout } =
          await import("../utils/authService");
        const tokensExist = hasGoogleTokensInStorage();

        if (!tokensExist) {
          console.warn(
            "[Storage] Google tokens not found in sessionStorage - redirecting to re-authenticate",
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
          return;
        }

        // Fetch user profile info (including picture)
        try {
          const { getUserProfile } = await import("../utils/authService");
          const profile = await getUserProfile();
          if (profile) {
            setUserInfo(profile.email, profile.name, profile.picture);
          } else {
            // Fallback if profile fetch fails
            setUserInfo(email, email.split("@")[0]);
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          // Fallback if profile fetch fails
          setUserInfo(email, email.split("@")[0]);
        }

        // Load user files
        try {
          await fetchAndStoreFileMetadata();
          setDecryptionError(false); // Clear error if successful
        } catch (metadataError: any) {
          if (metadataError.name === "DecryptionError") {
            setDecryptionError(true); // Set error flag for banner
            console.error("Decryption error:", metadataError);
            // Don't throw, just log - user will see banner
          } else {
            throw metadataError; // Re-throw other errors
          }
        }

        const files = await getAllFilesForUser(email);
        setUserHasFiles(files.length > 0);

        // Check for sharing keys and attempt recovery if needed
        await recoverRsaKeysIfNeeded(email, false);
      } catch (error) {
        console.error("Error loading user info or storage:", error);
        toast.error("Failed to load storage", {
          description:
            "An error occurred while loading your storage. Please try refreshing the page.",
        });
      } finally {
        setIsLoadingUserFiles(false);
      }
    };

    loadInitialData();
  }, [setUserInfo]);

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
    }
  }, [userEmail, refreshFileListKey]);

  // Listen for sidebar upload trigger
  useEffect(() => {
    const handleUploadTrigger = () => {
      handleUploadTriggerInternal();
    };

    window.addEventListener("trigger-upload", handleUploadTrigger);
    return () =>
      window.removeEventListener("trigger-upload", handleUploadTrigger);
  }, []);

  // Listen for sidebar delete all trigger
  useEffect(() => {
    const handleDeleteTrigger = () => {
      if (!userEmail) return;
      setShowDeleteConfirm(true);
    };

    window.addEventListener("trigger-delete-all", handleDeleteTrigger);
    return () =>
      window.removeEventListener("trigger-delete-all", handleDeleteTrigger);
  }, [userEmail]);

  const handleRefreshFiles = async () => {
    if (!userEmail) {
      toast.error("User information not available to refresh files.");
      return;
    }
    setIsRefreshingFiles(true);
    const refreshToastId = toast.loading("Refreshing file list...");
    try {
      try {
        await fetchAndStoreFileMetadata();
        setDecryptionError(false); // Clear error if successful
      } catch (metadataError: any) {
        if (metadataError.name === "DecryptionError") {
          setDecryptionError(true); // Set error flag for banner
          console.error("Decryption error:", metadataError);
          toast.error("Failed to decrypt metadata file.", {
            description: "Please ensure you have the correct encryption key.",
            id: refreshToastId,
          });
          setIsRefreshingFiles(false);
          return; // Don't continue if decryption fails
        } else {
          throw metadataError; // Re-throw other errors
        }
      }

      const files = await getAllFilesForUser(userEmail);
      setUserHasFiles(files.length > 0);
      setRefreshFileListKey((prev) => prev + 1);
      await refreshAll(); // Also refresh credits and storage
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

  const handleUploadTriggerInternal = async () => {
    const key = await getStoredKey();
    if (!key) {
      toast.error("No encryption key found", {
        description: "Please generate or upload an encryption key first",
      });
      return;
    }
    document.getElementById("file-upload")?.click();
  };

  const handleFileChangeAndUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
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
      await refreshAll(); // Refresh credits and storage after upload
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
      await refreshAll(); // Refresh credits and storage after delete
    }
  };

  return (
    <>
      {/* Hidden file input for uploads triggered from sidebar */}
      <input
        type="file"
        id="file-upload"
        multiple
        className="hidden"
        onChange={handleFileChangeAndUpload}
        disabled={uploading}
      />

      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
            <p className="text-muted-foreground">
              {!isLoadingUserFiles && userHasFiles
                ? "Manage your encrypted files. Click file names to download and decrypt."
                : !isLoadingUserFiles
                  ? "No files uploaded yet. Use the Upload button in the sidebar to get started."
                  : "Loading your files..."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshFiles}
            disabled={isRefreshingFiles || isLoadingUserFiles}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                isRefreshingFiles ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* File List */}
        <FileList
          view="compact"
          refreshKey={refreshFileListKey}
          userEmail={userEmail}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete All Files?"
          description="Are you sure you want to delete ALL files? This action cannot be undone."
          onConfirm={performDeleteAllFiles}
          confirmText={isDeleting ? "Deleting..." : "Delete All"}
        />
      </div>
    </>
  );
}

export default PrivateStorage;
