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
import {
  RefreshCw,
  FolderPlus,
  Upload,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  FolderProvider,
  useFolderContext,
} from "../components/storage/folder-context";
import { CreateFolderDialog } from "../components/storage/create-folder-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

// Imports for sharing key functionality (kept for potential future use)
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";

function PrivateStorageContent() {
  const { currentFolderId } = useFolderContext();
  const { userEmail, setUserInfo, refreshAll, setDecryptionError } = useApp();
  const [uploading, setUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);
  const [userHasFiles, setUserHasFiles] = useState<boolean>(false);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState<boolean>(true);
  const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
  }, [setUserInfo, setDecryptionError]);

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
      await refreshAll(); // Refresh storage
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

  const uploadFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0 || !userEmail) return;

    // Encryption key is required to upload (files are encrypted client-side)
    const key = await getStoredKey();
    if (!key) {
      toast.error("No encryption key found", {
        description: "Please generate or upload an encryption key first",
      });
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const file of filesToUpload) {
      const result = await uploadAndSyncFile(file, userEmail, currentFolderId);
      if (result) successCount++;
    }

    setUploading(false);

    if (successCount > 0) {
      setRefreshFileListKey((prev) => prev + 1);
      setUserHasFiles(true);
      await refreshAll(); // Refresh storage after upload
    }
  };

  const handleFileChangeAndUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files) return;
    const filesToUpload = Array.from(e.target.files);
    e.target.value = "";
    await uploadFiles(filesToUpload);
  };

  // Only treat external file drags (not internal file-to-folder moves) as uploads
  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types || []).includes("Files");

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Ignore drag-leave when moving between child elements
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    await uploadFiles(dropped);
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
      await refreshAll(); // Refresh storage after delete
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

      <div
        className="relative space-y-6"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag-and-drop upload overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium">Drop files to upload</p>
            <p className="text-xs text-muted-foreground">
              Encrypted on your device before they leave.
            </p>
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl tracking-tight">Storage</h1>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleUploadTriggerInternal}
              disabled={uploading || isLoadingUserFiles}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
              disabled={isLoadingUserFiles}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-2"
                  aria-label="More actions"
                  disabled={isLoadingUserFiles}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* File List (toolbar + breadcrumb live inside FileList) */}
        <FileList
          view="full"
          refreshKey={refreshFileListKey}
          userEmail={userEmail}
        />

        {/* Persistent drop hint */}
        <div className="flex items-center justify-center gap-2 border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          <Upload className="h-4 w-4" />
          Drop files anywhere to upload — encrypted on your device before they
          leave.
        </div>

        {/* Create Folder Dialog */}
        {userEmail && (
          <CreateFolderDialog
            open={showCreateFolder}
            onOpenChange={setShowCreateFolder}
            parentFolderId={currentFolderId}
            userEmail={userEmail}
            onSuccess={() => {
              setRefreshFileListKey((prev) => prev + 1);
              setUserHasFiles(true);
            }}
          />
        )}

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

function PrivateStorage() {
  return (
    <FolderProvider>
      <PrivateStorageContent />
    </FolderProvider>
  );
}

export default PrivateStorage;
