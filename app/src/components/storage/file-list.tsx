import React, { useState, useEffect } from "react";
import {
  FileMeta,
  getAllFilesForUser,
  addFile,
  deleteFileFromDB,
  sendToGoogleDrive,
} from "../../utils/dexieDB";
import { gapi } from "gapi-script";

import { decryptFile } from "../../utils/decryptFile";
import { Trash2 } from "lucide-react";
import {
  MimeTypeCategory,
  iconMap,
  mimeTypeCategories,
} from "../../lib/mime-types";
import { getStoredKey } from "../../utils/cryptoUtils";
import { toast } from "sonner";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Button } from "../ui/button";

interface FileListProps {
  view?: "compact" | "recent" | "full";
  refreshKey?: number;
}

export const FileList: React.FC<FileListProps> = ({
  view = "full",
  refreshKey,
}) => {
  const [allUserFiles, setAllUserFiles] = useState<FileMeta[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMeta[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [filter, setFilter] = useState<MimeTypeCategory | "All Files">(
    "All Files"
  );
  const [availableFilters, setAvailableFilters] = useState<
    (MimeTypeCategory | "All Files")[]
  >(["All Files"]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean>(false);
  const [isOn, setIsOn] = useState(true);
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);

  useEffect(() => {
    const initAndGetUser = () => {
      console.log("[FileList] Attempting to initialize GAPI client...");
      try {
        gapi.load("client:auth2", () => {
          gapi.client
            .init({
              clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
              scope: process.env.REACT_APP_PUBLIC_SCOPE,
            })
            .then(() => {
              console.log("[FileList] GAPI client initialized.");
              const authInstance = gapi.auth2?.getAuthInstance();
              if (authInstance && authInstance.isSignedIn.get()) {
                const profile = authInstance.currentUser
                  .get()
                  .getBasicProfile();
                if (profile) {
                  const email = profile.getEmail();
                  console.log(`[FileList] User email obtained: ${email}`);
                  setUserEmail(email);
                } else {
                  console.warn(
                    "[FileList] GAPI signed in but profile is null."
                  );
                }
              } else {
                console.warn(
                  "[FileList] GAPI not signed in or auth instance unavailable."
                );
              }
            })
            .catch((initError) => {
              console.error("[FileList] GAPI client init error:", initError);
            });
        });
      } catch (loadError) {
        console.error("[FileList] GAPI load error:", loadError);
      }
    };
    if (!userEmail) {
      initAndGetUser();
    }
  }, [userEmail]);

  useEffect(() => {
    const checkKey = async () => {
      const key = await getStoredKey();
      setHasEncryptionKey(!!key);
    };
    checkKey();
  }, []);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!userEmail) {
        console.log(
          `[FileList - ${view}] Waiting for user email to fetch files.`
        );
        setAllUserFiles([]);
        setFilteredFiles([]);
        setIsLoadingFiles(false);
        return;
      }

      console.log(
        `[FileList - ${view}] Fetching files for ${userEmail}, Key: ${refreshKey}`
      );
      setIsLoadingFiles(true);
      try {
        const userFiles = await getAllFilesForUser(userEmail);
        console.log(
          `[FileList - ${view}] Found ${userFiles.length} files in DB for ${userEmail}.`
        );

        let displayFiles = userFiles;
        if (view === "recent") {
          displayFiles = [...userFiles]
            .sort(
              (a, b) =>
                new Date(b.uploadedDate).getTime() -
                new Date(a.uploadedDate).getTime()
            )
            .slice(0, 5);
        }

        setAllUserFiles(displayFiles);
        setFilteredFiles(displayFiles);

        const available = Object.keys(mimeTypeCategories).filter((category) => {
          const mimeTypes = mimeTypeCategories[category as MimeTypeCategory];
          return userFiles.some((file) => mimeTypes.includes(file.mimeType));
        }) as (MimeTypeCategory | "All Files")[];
        setAvailableFilters(["All Files", ...available]);
      } catch (error) {
        console.error(`[FileList - ${view}] Error fetching files:`, error);
        toast.error("Failed to load files");
        setAllUserFiles([]);
        setFilteredFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFiles();
  }, [userEmail, view, refreshKey]);

  useEffect(() => {
    console.log(
      `[FileList - ${view}] Applying filters. Current filter: ${filter}, Query: ${searchQuery}`
    );
    let results = allUserFiles;

    if (filter !== "All Files") {
      if (filter === "Others") {
        results = results.filter(
          (file) =>
            !Object.values(mimeTypeCategories).flat().includes(file.mimeType)
        );
      } else {
        results = results.filter((file) =>
          mimeTypeCategories[filter as MimeTypeCategory]?.includes(
            file.mimeType
          )
        );
      }
    }

    if (searchQuery) {
      results = results.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredFiles(results);
    console.log(
      `[FileList - ${view}] Filtering applied, ${results.length} files shown.`
    );
  }, [filter, searchQuery, allUserFiles, view]);

  useEffect(() => {
    if (view !== "full") {
      setIsOn(false);
    } else {
      setIsOn(true);
    }
  }, [view]);

  const downloadAndDecryptFile = async (fileId: string, fileName: string) => {
    setDownloadingFileId(fileId);

    try {
      const key = await getStoredKey();
      if (!key) {
        toast.error("No encryption key found", {
          description: "Please upload your encryption key first.",
        });
        setDownloadingFileId(null);
        return;
      }

      const authInstance = gapi.auth2.getAuthInstance();
      if (!authInstance || !authInstance.isSignedIn.get()) {
        toast.error("Authentication error", {
          description: "Please sign in again",
        });
        setDownloadingFileId(null);
        return;
      }

      const token = authInstance.currentUser
        .get()
        .getAuthResponse().access_token;

      toast.loading(`Downloading: ${fileName}...`);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          method: "GET",
          headers: new Headers({ Authorization: `Bearer ${token}` }),
        }
      );

      if (!response.ok) {
        toast.error("Failed to download file", {
          description: response.statusText || `HTTP error: ${response.status}`,
        });
        setDownloadingFileId(null);
        return;
      }

      const fileBlob = await response.blob();

      toast.loading("Decrypting file...");

      try {
        const decryptedBlob = await decryptFile(fileBlob);

        const url = URL.createObjectURL(decryptedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        toast.success("File successfully decrypted and downloaded");

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (decryptionError) {
        console.error("Decryption error:", decryptionError);

        const errorMessage =
          decryptionError.message || "Unknown decryption error";

        if (errorMessage.includes("key doesn't match")) {
          toast.error("Wrong encryption key", {
            description:
              "The key you're using doesn't match the one used to encrypt this file.",
          });
        } else if (errorMessage.includes("No encryption key found")) {
          toast.error("Encryption key missing", {
            description: "Please upload your encryption key first.",
          });
        } else if (errorMessage.includes("Invalid encryption key format")) {
          toast.error("Invalid encryption key", {
            description:
              "Your stored encryption key appears to be corrupted. Please upload a new one.",
          });
        } else {
          toast.error("Decryption failed", {
            description: errorMessage,
          });
        }
      }
    } catch (error) {
      console.error("Error during file download or decryption:", error);
      toast.error("Error during file download", {
        description: error.message || "An unknown error occurred",
      });
    } finally {
      setDownloadingFileId(null);
      toast.dismiss();
    }
  };

  const performDelete = async () => {
    if (!fileToDelete || !userEmail) return;

    const { id: fileId, name: fileName } = fileToDelete;
    let deleteToastId: string | number | undefined;
    let deleteSuccess = false;

    try {
      deleteToastId = toast.loading(`Deleting ${fileName}...`);

      const authInstance = gapi.auth2.getAuthInstance();
      if (!authInstance || !authInstance.isSignedIn.get())
        throw new Error("Authentication error");
      const token = authInstance.currentUser
        .get()
        .getAuthResponse().access_token;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: "DELETE",
          headers: new Headers({ Authorization: `Bearer ${token}` }),
        }
      );
      if (!response.ok && response.status !== 404) {
        console.warn(`Drive delete failed: ${response.statusText}`);
      }

      await deleteFileFromDB(fileId);
      toast.info(`Removed ${fileName} locally.`, { id: deleteToastId });

      const updatedFiles = await getAllFilesForUser(userEmail);
      setAllUserFiles(updatedFiles);
      setFilteredFiles(updatedFiles);

      console.log("[FileList] Deletion complete, syncing metadata...");
      await sendToGoogleDrive(updatedFiles);

      toast.success(`Deleted ${fileName} and synced metadata.`, {
        id: deleteToastId,
      });
      deleteSuccess = true;
    } catch (error) {
      console.error("Error during delete process:", error);
      toast.error(`Failed to delete ${fileName}`, {
        description: error.message || "An unknown error occurred",
        id: deleteToastId,
      });
      deleteSuccess = false;
    } finally {
      setFileToDelete(null);
      setShowDeleteConfirm(false);
      if (deleteSuccess) {
        console.log("[FileList] Delete successful. State updated.");
      }
    }
  };

  const deleteFileHandler = (
    fileId: string,
    fileName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setFileToDelete({ id: fileId, name: fileName });
    setShowDeleteConfirm(true);
  };

  if (view === "compact" || view === "recent") {
    return (
      <div className="p-1">
        {isLoadingFiles ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            Loading...
          </p>
        ) : filteredFiles.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredFiles.map((file) => (
              <Button
                key={file.id}
                onClick={() => downloadAndDecryptFile(file.id, file.name)}
                title={`Download ${file.name}`}
                className="w-fit group pr-3"
              >
                <div className="flex items-center gap-1.5 overflow-hidden flex-grow min-w-0 max-w-full">
                  <span className="truncate flex-grow">{file.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                  {downloadingFileId === file.id ? (
                    <span className="text-xs animate-pulse">
                      Downloading...
                    </span>
                  ) : (
                    <>
                      {view === "recent" ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(file.uploadedDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <button
                          onClick={(e) =>
                            deleteFileHandler(file.id, file.name, e)
                          }
                          className="text-red-500 hover:text-destructive focus:outline-none p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          aria-label="Delete file"
                          title="Delete file"
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-left text-xs text-muted-foreground py-4">
            No recent uploads
          </p>
        )}

        <ConfirmationDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title={`Delete "${fileToDelete?.name || "this file"}"?`}
          description="Are you sure you want to delete this file? This action cannot be undone."
          onConfirm={performDelete}
          confirmText="Delete"
        />
      </div>
    );
  }
};
