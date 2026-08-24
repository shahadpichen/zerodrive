import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileList } from "../components/storage/file-list";
import { Button } from "../components/ui/button";
import { userNotifications as toast } from "../utils/userNotifications";
import { useApp } from "../contexts/app-context";

import { hasMnemonic } from "../utils/mnemonicManager";
import { hasVaultReadAccess } from "../utils/vaultAccess";
import { fetchAndStoreFileMetadata } from "../utils/dexieDB";
import { deleteAllAndSyncFiles } from "../utils/fileOperations";
import { ConfirmationDialog } from "../components/storage/confirmation-dialog";
import {
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useVaultData } from "../contexts/vault-data-context";
import { ensureGoogleDrivePermissionForAction } from "../utils/googleDrivePermissions";
import { useUploadQueue } from "../contexts/upload-queue-context";

// Imports for sharing key functionality (kept for potential future use)
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";

const METADATA_REPLACE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createMetadataReplaceCode() {
  const values = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(values, (value) =>
    METADATA_REPLACE_CODE_CHARS.charAt(
      value % METADATA_REPLACE_CODE_CHARS.length,
    ),
  ).join("");
}

function PrivateStorageContent() {
  const navigate = useNavigate();
  const { currentFolderId } = useFolderContext();
  const {
    userEmail,
    setUserInfo,
    refreshAll,
    hasDecryptionError,
    setDecryptionError,
  } = useApp();
  const {
    state: vaultState,
    refreshVaultFromLocal,
    setVaultKeyStatus,
    setVaultMetadataStatus,
  } = useVaultData();
  const { enqueueUploads, hasPendingUploads, tryAcquireUploadExclusion } =
    useUploadQueue();
  const hasCurrentVaultSnapshot =
    !!userEmail &&
    vaultState.userEmail === userEmail.trim().toLowerCase() &&
    !vaultState.isHydrating;
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMetadataReplaceConfirm, setShowMetadataReplaceConfirm] =
    useState(false);
  const [metadataReplaceCode, setMetadataReplaceCode] = useState("");
  const [metadataReplaceInput, setMetadataReplaceInput] = useState("");
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[] | null>(
    null,
  );
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);
  const [isLoadingUserFiles, setIsLoadingUserFiles] = useState<boolean>(
    !hasCurrentVaultSnapshot,
  );
  const [isRefreshingFiles, setIsRefreshingFiles] = useState<boolean>(false);
  const [isVerifyingVaultMetadata, setIsVerifyingVaultMetadata] =
    useState<boolean>(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasVaultKey, setHasVaultKey] = useState<boolean | null>(
    hasCurrentVaultSnapshot ? vaultState.hasVaultKey : null,
  );
  const initialVaultStateRef = useRef(vaultState);
  const activeUserEmail = userEmail.trim().toLowerCase();
  const hasCurrentUserVaultState =
    !!activeUserEmail && vaultState.userEmail === activeUserEmail;
  const isVaultSafetyCheckPending =
    isLoadingUserFiles ||
    isVerifyingVaultMetadata ||
    isRefreshingFiles ||
    (hasCurrentUserVaultState && vaultState.metadataStatus === "verifying");
  const isVaultMetadataUploadSafe =
    hasCurrentUserVaultState &&
    (vaultState.metadataStatus === "ready" ||
      vaultState.metadataStatus === "decryption_error");
  const isVaultMetadataWriteSafe =
    hasCurrentUserVaultState && vaultState.metadataStatus === "ready";
  const showPendingUploadsBeforeDeleteToast = useCallback(() => {
    toast.info("Uploads are still pending", {
      description:
        "Wait for them to finish, or cancel them in the upload tray, before deleting all files.",
      id: "storage:delete-all:uploads-pending",
    });
  }, []);

  const showVaultMetadataBlockedToast = useCallback(() => {
    toast.error("Encrypted file list could not be verified", {
      description:
        "Refresh Storage before uploading so ZeroDrive does not replace an existing encrypted file list with stale local data.",
      id: "storage:file-list-unverified",
    });
  }, []);

  const openRecoveryAccess = useCallback(() => {
    navigate("/recovery-access?returnTo=%2Fstorage");
  }, [navigate]);

  const openMetadataReplaceConfirm = (filesToUpload: File[]) => {
    setPendingUploadFiles(filesToUpload);
    setMetadataReplaceCode(createMetadataReplaceCode());
    setMetadataReplaceInput("");
    setShowMetadataReplaceConfirm(true);
  };

  const closeMetadataReplaceConfirm = () => {
    setShowMetadataReplaceConfirm(false);
    setPendingUploadFiles(null);
    setMetadataReplaceInput("");
  };

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
            id: "storage:authentication",
          });
          // Clear auth and redirect
          const { logout } = await import("../utils/authService");
          await logout();
          window.location.href = "/";
          return;
        }

        // Make the verified account available to the global providers
        // before Drive work so local vault data can render at once.
        setUserInfo(email, email.split("@")[0]);

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

        const hasVaultAccess = await hasVaultReadAccess();
        setHasVaultKey(hasVaultAccess);
        setVaultKeyStatus(email, hasVaultAccess);

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
            id: "storage:drive-connection",
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

        // A verified snapshot survives route navigation in VaultDataProvider.
        // Direct page loads still verify Drive in the background while the
        // account-scoped local snapshot remains visible.
        const hasVerifiedVaultSnapshot =
          initialVaultStateRef.current.userEmail ===
            email.trim().toLowerCase() &&
          initialVaultStateRef.current.metadataStatus === "ready";
        let metadataStatus = initialVaultStateRef.current.metadataStatus;
        if (!hasVerifiedVaultSnapshot) {
          setIsVerifyingVaultMetadata(true);
          setVaultMetadataStatus(email, "verifying");
          try {
            await fetchAndStoreFileMetadata();
            setDecryptionError(false); // Clear error if successful
            metadataStatus = "ready";
          } catch (metadataError: any) {
            if (metadataError.name === "DecryptionError") {
              setDecryptionError(true); // Set error flag for banner
              metadataStatus = "decryption_error";
              console.error("Decryption error:", metadataError);
              // Don't throw, just log - user will see banner
            } else {
              metadataStatus = "error";
              setVaultMetadataStatus(
                email,
                "error",
                "The encrypted file list could not be verified.",
              );
              throw metadataError; // Re-throw other errors
            }
          } finally {
            setIsVerifyingVaultMetadata(false);
          }
        }

        await refreshVaultFromLocal(email, {
          metadataStatus,
        });

        // Check for sharing keys and attempt recovery if needed
        await recoverRsaKeysIfNeeded(email);
      } catch (error) {
        console.error("Error loading user info or storage:", error);
        toast.error("Failed to load storage", {
          description:
            "An error occurred while loading your storage. Please try refreshing the page.",
          id: "storage:load",
        });
      } finally {
        setIsLoadingUserFiles(false);
      }
    };

    loadInitialData();
  }, [
    refreshVaultFromLocal,
    setDecryptionError,
    setUserInfo,
    setVaultKeyStatus,
    setVaultMetadataStatus,
  ]);

  useEffect(() => {
    if (!userEmail) return;
    if (vaultState.userEmail !== userEmail.trim().toLowerCase()) return;

    setIsLoadingUserFiles(vaultState.isHydrating);
    if (vaultState.hasVaultKey !== null) {
      setHasVaultKey(vaultState.hasVaultKey);
    }
  }, [userEmail, vaultState]);

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
    if (!ensureGoogleDrivePermissionForAction("storage")) return;

    if (!userEmail) {
      toast.error("User information not available to refresh files.", {
        id: "storage:refresh",
      });
      return;
    }
    setIsRefreshingFiles(true);
    setIsVerifyingVaultMetadata(true);
    setVaultMetadataStatus(userEmail, "verifying");
    const refreshToastId = "storage:refresh";
    toast.loading("Refreshing encrypted file list…", { id: refreshToastId });
    try {
      try {
        await fetchAndStoreFileMetadata();
        setDecryptionError(false); // Clear error if successful
      } catch (metadataError: any) {
        if (metadataError.name === "DecryptionError") {
          setDecryptionError(true); // Set error flag for banner
          setVaultMetadataStatus(userEmail, "decryption_error");
          console.error("Decryption error:", metadataError);
          toast.error("Encrypted file list could not be opened", {
            description:
              "Open Recovery & Access and enter the phrase used for this vault.",
            id: refreshToastId,
          });
          setIsRefreshingFiles(false);
          return; // Don't continue if decryption fails
        } else {
          throw metadataError; // Re-throw other errors
        }
      }

      await refreshVaultFromLocal(userEmail, {
        metadataStatus: "ready",
      });
      setRefreshFileListKey((prev) => prev + 1);
      await refreshAll(); // Refresh storage
      toast.success("Storage refreshed", {
        id: refreshToastId,
      });
    } catch (error: unknown) {
      setVaultMetadataStatus(
        userEmail,
        "error",
        "The encrypted file list could not be verified.",
      );
      console.error("Error refreshing files:", error);
      toast.errorFrom(
        error,
        {
          title: "Storage could not be refreshed",
          description: "Check your Google Drive connection and retry.",
        },
        { id: refreshToastId },
      );
    } finally {
      setIsVerifyingVaultMetadata(false);
      setIsRefreshingFiles(false);
    }
  };

  const handleUploadTriggerInternal = useCallback(async () => {
    if (!ensureGoogleDrivePermissionForAction("upload")) return;

    if (isVaultSafetyCheckPending) {
      toast.info("Checking the encrypted file list", {
        description:
          "Wait for ZeroDrive to finish checking your encrypted file list before uploading.",
        id: "storage:file-list-check",
      });
      return;
    }

    const hasVaultAccess = hasMnemonic();
    setHasVaultKey(hasVaultAccess);
    if (userEmail) setVaultKeyStatus(userEmail, hasVaultAccess);
    if (!hasVaultAccess) {
      toast.info("Set up Recovery & Access first", {
        description:
          "Create a new recovery phrase or enter your existing one before uploading files.",
        id: "storage:vault-access",
      });
      openRecoveryAccess();
      return;
    }

    if (!isVaultMetadataUploadSafe) {
      showVaultMetadataBlockedToast();
      return;
    }
    document.getElementById("file-upload")?.click();
  }, [
    isVaultSafetyCheckPending,
    isVaultMetadataUploadSafe,
    openRecoveryAccess,
    setVaultKeyStatus,
    showVaultMetadataBlockedToast,
    userEmail,
  ]);

  // Listen for sidebar upload trigger. Keep the handler fresh so global upload
  // uses the same vault-access and metadata-replacement checks as this page.
  useEffect(() => {
    const handleUploadTrigger = () => {
      void handleUploadTriggerInternal();
    };

    window.addEventListener("trigger-upload", handleUploadTrigger);
    return () =>
      window.removeEventListener("trigger-upload", handleUploadTrigger);
  }, [handleUploadTriggerInternal]);

  const uploadFiles = async (
    filesToUpload: File[],
    options: { skipMetadataReplaceWarning?: boolean } = {},
  ) => {
    if (filesToUpload.length === 0 || !userEmail) return;

    if (!ensureGoogleDrivePermissionForAction("upload")) return;

    if (isVaultSafetyCheckPending) {
      toast.info("Checking the encrypted file list", {
        description:
          "Wait for ZeroDrive to finish checking your encrypted file list before uploading.",
        id: "storage:file-list-check",
      });
      return;
    }

    // Encryption key is required to upload (files are encrypted client-side)
    const hasVaultAccess = hasMnemonic();
    setHasVaultKey(hasVaultAccess);
    setVaultKeyStatus(userEmail, hasVaultAccess);
    if (!hasVaultAccess) {
      toast.info("Set up Recovery & Access first", {
        description:
          "Create a new recovery phrase or enter your existing one before uploading files.",
        id: "storage:vault-access",
      });
      openRecoveryAccess();
      return;
    }

    if (!isVaultMetadataUploadSafe) {
      showVaultMetadataBlockedToast();
      return;
    }

    if (
      (hasDecryptionError ||
        vaultState.metadataStatus === "decryption_error") &&
      !options.skipMetadataReplaceWarning
    ) {
      openMetadataReplaceConfirm(filesToUpload);
      return;
    }

    try {
      enqueueUploads(
        filesToUpload.map((file) => ({
          file,
          userEmail,
          folderId: currentFolderId,
          allowMetadataReplacement:
            options.skipMetadataReplaceWarning &&
            vaultState.metadataStatus === "decryption_error",
        })),
      );
    } catch (error) {
      toast.errorFrom(
        error,
        {
          title: "Files could not be added to uploads",
          description:
            "Choose the files again after the current Storage action finishes.",
        },
        { id: "storage:enqueue" },
      );
    }
  };

  const handleMetadataReplaceConfirm = async () => {
    if (metadataReplaceInput.trim().toUpperCase() !== metadataReplaceCode) {
      return;
    }

    const filesToUpload = pendingUploadFiles;
    setShowMetadataReplaceConfirm(false);
    setPendingUploadFiles(null);
    setMetadataReplaceInput("");

    if (!filesToUpload) return;

    await uploadFiles(filesToUpload, { skipMetadataReplaceWarning: true });
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

    const releaseUploadExclusion = tryAcquireUploadExclusion(userEmail);
    if (!releaseUploadExclusion) {
      showPendingUploadsBeforeDeleteToast();
      setShowDeleteConfirm(false);
      return;
    }

    try {
      if (!ensureGoogleDrivePermissionForAction("storage")) {
        setShowDeleteConfirm(false);
        return;
      }

      if (!isVaultMetadataWriteSafe) {
        showVaultMetadataBlockedToast();
        setShowDeleteConfirm(false);
        return;
      }

      // Check for encryption key before allowing deletion
      const hasVaultAccess = hasMnemonic();
      setHasVaultKey(hasVaultAccess);
      setVaultKeyStatus(userEmail, hasVaultAccess);
      if (!hasVaultAccess) {
        toast.error("Recovery & Access required", {
          description:
            "Recover access to this vault before deleting encrypted files.",
          id: "storage:delete-all:vault-access",
        });
        setShowDeleteConfirm(false);
        openRecoveryAccess();
        return;
      }

      setIsDeleting(true);
      const success = await deleteAllAndSyncFiles(userEmail);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      if (success) {
        await refreshVaultFromLocal(userEmail, { metadataStatus: "ready" });
        setRefreshFileListKey((prev) => prev + 1);
        await refreshAll(); // Refresh storage after delete
      }
    } finally {
      releaseUploadExclusion();
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="text-2xl tracking-tight">Storage</h1>
            {hasVaultKey === false ? (
              <p className="text-sm font-light leading-relaxed text-muted-foreground">
                Set up vault access before using Storage. You can create a new
                recovery phrase or enter an existing one for this browser.
              </p>
            ) : (
              <p className="text-sm font-light leading-relaxed text-muted-foreground">
                This is your encrypted vault. Files are encrypted in this
                browser before the protected copy is saved to your Google Drive.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end lg:pt-2">
            <Button
              size="sm"
              onClick={
                hasVaultKey === false
                  ? openRecoveryAccess
                  : handleUploadTriggerInternal
              }
              disabled={isLoadingUserFiles}
            >
              <Upload className="h-4 w-4 mr-2" />
              {hasVaultKey === false ? "Set up access" : "Upload"}
            </Button>
            {hasVaultKey !== false && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!ensureGoogleDrivePermissionForAction("folder")) return;
                  setShowCreateFolder(true);
                }}
                disabled={isLoadingUserFiles || !isVaultMetadataWriteSafe}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            )}
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
            {hasVaultKey !== false && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2"
                    aria-label="More actions"
                    disabled={isLoadingUserFiles || !isVaultMetadataWriteSafe}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (hasPendingUploads(userEmail)) {
                        showPendingUploadsBeforeDeleteToast();
                        return;
                      }
                      setShowDeleteConfirm(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Files
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* File List (toolbar + breadcrumb live inside FileList) */}
        <FileList
          view="full"
          refreshKey={refreshFileListKey}
          userEmail={userEmail}
          onUploadClick={handleUploadTriggerInternal}
          hasVaultKey={hasVaultKey}
          onRecoverAccessClick={openRecoveryAccess}
          isVaultMetadataLoading={
            (!userEmail && isLoadingUserFiles) || isVaultSafetyCheckPending
          }
          canWriteVaultMetadata={isVaultMetadataWriteSafe}
        />

        {/* Persistent drop hint */}
        <div className="flex items-center justify-center gap-2 border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          <Upload className="h-4 w-4" />
          {hasVaultKey === false
            ? "Recover vault access first, then drop files here to upload."
            : "Drop files anywhere to upload — encrypted on your device before they leave."}
        </div>

        {/* Create Folder Dialog */}
        {userEmail && (
          <CreateFolderDialog
            open={showCreateFolder}
            onOpenChange={setShowCreateFolder}
            parentFolderId={currentFolderId}
            userEmail={userEmail}
            onSuccess={() => {
              void refreshVaultFromLocal(userEmail, {
                metadataStatus: "ready",
              });
              setRefreshFileListKey((prev) => prev + 1);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Permanently delete every encrypted file?"
          description="This removes every encrypted file ZeroDrive knows about from your vault and syncs the deletion to Google Drive. Downloads or recovery are not possible from ZeroDrive after this completes."
          onConfirm={performDeleteAllFiles}
          confirmText={isDeleting ? "Deleting..." : "Delete every file"}
        />

        <Dialog
          open={showMetadataReplaceConfirm}
          onOpenChange={(open) => {
            if (open) setShowMetadataReplaceConfirm(true);
            else closeMetadataReplaceConfirm();
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-destructive text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>
                    Existing vault index could not be opened
                  </DialogTitle>
                  <DialogDescription className="mt-2 leading-relaxed">
                    ZeroDrive found your encrypted file list in Google Drive,
                    but this browser could not open it with the current recovery
                    phrase.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-sm leading-relaxed">
              <div className="border border-destructive/60 bg-destructive/5 p-4">
                <p className="font-semibold text-destructive">
                  Continuing will start a fresh vault index.
                </p>
                <p className="mt-2 text-muted-foreground">
                  The new upload will replace that encrypted file list with a
                  new one protected by the current key. Older encrypted files
                  may still exist in your Google Drive, but they may no longer
                  appear in ZeroDrive unless you recover the phrase that can
                  open the old file list.
                </p>
              </div>

              <div>
                <Label htmlFor="metadata-replace-code">
                  Type this code to continue:
                </Label>
                <div className="mt-2 inline-flex border px-3 py-2 font-mono text-lg tracking-[0.24em]">
                  {metadataReplaceCode}
                </div>
                <Input
                  id="metadata-replace-code"
                  className="mt-3 font-mono uppercase tracking-[0.16em]"
                  value={metadataReplaceInput}
                  onChange={(event) =>
                    setMetadataReplaceInput(event.target.value.toUpperCase())
                  }
                  placeholder="Enter confirmation code"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeMetadataReplaceConfirm}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  metadataReplaceInput.trim().toUpperCase() !==
                  metadataReplaceCode
                }
                onClick={handleMetadataReplaceConfirm}
              >
                Start fresh and upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
