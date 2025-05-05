import React, { useState, useEffect } from "react";
import { gapi } from "gapi-script";
import { FileList } from "../components/storage/file-list";
import { ModeToggle } from "../components/mode-toggle";
import { KeyManagement } from "../components/storage/download-key";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

import { getStoredKey } from "../utils/cryptoUtils";
import { getAllFilesForUser } from "../utils/dexieDB";
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
import { Zap } from "lucide-react";

function PrivateStorage() {
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
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean>(true);

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

  const loadStorageInfo = async () => {
    const authInstance = gapi.auth2?.getAuthInstance();
    if (!authInstance || !authInstance.isSignedIn.get()) {
      console.warn("[StorageInfo] Not signed in, cannot fetch storage.");
      setStorageInfo(null);
      setIsLoadingStorage(false);
      return;
    }

    setIsLoadingStorage(true);
    try {
      const token = authInstance.currentUser
        .get()
        .getAuthResponse().access_token;
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
        await new Promise<void>((resolve, reject) => {
          gapi.load("client:auth2", {
            callback: resolve,
            onerror: reject,
            timeout: 5000,
            ontimeout: reject,
          });
        });

        await gapi.client.init({
          clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
        });

        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance && authInstance.isSignedIn.get()) {
          const profile = authInstance.currentUser.get().getBasicProfile();
          if (profile) {
            setUserName(profile.getName());
            const email = profile.getEmail();
            setUserEmail(email);
            setUserImage(profile.getImageUrl());
            if (email) {
              const files = await getAllFilesForUser(email);
              setUserHasFiles(files.length > 0);
              await loadStorageInfo();
            } else {
              setUserHasFiles(false);
              setStorageInfo(null);
            }
          } else {
            window.location.href = "/";
          }
        } else {
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Error loading user info or storage:", error);
        window.location.href = "/";
      } finally {
        setIsLoadingUserFiles(false);
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
    }
  }, [userEmail, refreshFileListKey]);

  const handleLogout = async () => {
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      if (authInstance) {
        await authInstance.signOut();
        localStorage.removeItem("isAuthenticated");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error during logout:", error);
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

  const usagePercentage = storageInfo
    ? storageInfo.total > 0
      ? (storageInfo.used / storageInfo.total) * 100
      : 0
    : 0;

  return (
    <div className="container mx-auto min-h-screen flex flex-col items-center bg-background text-foreground">
      <header className="w-full px-4 sm:px-6 py-3 flex items-center justify-between border-b border-foreground/10">
        <span className="font-semibold text-base sm:text-lg">ZeroDrive</span>
        <div className="flex items-center gap-3 sm:gap-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="col-span-1">
            <h2 className="text-base sm:text-lg mb-3 font-mono font-normal">
              Your Files
            </h2>
            <FileList view="compact" refreshKey={refreshFileListKey} />
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
                onClick={() => setShowKeyModal(true)}
              >
                Manage Encryption Keys
              </Button>
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
      {showKeyModal && <KeyManagement onClose={() => setShowKeyModal(false)} />}
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
