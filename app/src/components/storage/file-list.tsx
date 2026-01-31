import React, { useState, useEffect } from "react";
import {
  FileMeta,
  FolderMeta,
  getAllFilesForUser,
  addFile,
  deleteFileFromDB,
  sendToGoogleDrive,
  getFilesInFolder,
  getFoldersForUser,
} from "../../utils/dexieDB";
import { gapi } from "gapi-script";

import { decryptFile } from "../../utils/decryptFile";
import { Trash2, Eye } from "lucide-react";
import {
  MimeTypeCategory,
  iconMap,
  mimeTypeCategories,
} from "../../lib/mime-types";
import { getStoredKey } from "../../utils/cryptoUtils";
import { toast } from "sonner";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Button } from "../ui/button";
import { FilePreviewDialog } from "./file-preview-dialog";
import { isPreviewable } from "../../utils/filePreview";
import { useFolderContext } from "./folder-context";
import { FolderItem } from "./folder-item";

interface FileListProps {
  view?: "compact" | "recent" | "full";
  refreshKey?: number;
  userEmail?: string;
}

// Helper hook to safely get folder context
function useSafeFolderContext() {
  try {
    return useFolderContext();
  } catch {
    return { currentFolderId: null };
  }
}

export const FileList: React.FC<FileListProps> = ({
  view = "full",
  refreshKey,
  userEmail: userEmailProp,
}) => {
  const { currentFolderId } = useSafeFolderContext();
  const [allUserFiles, setAllUserFiles] = useState<FileMeta[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMeta[]>([]);
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const userEmail = userEmailProp || null;
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
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
    mimeType: string;
  } | null>(null);

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
        setFolders([]);
        setIsLoadingFiles(false);
        return;
      }

      console.log(
        `[FileList - ${view}] Fetching files for ${userEmail}, Key: ${refreshKey}, FolderId: ${currentFolderId}`
      );
      setIsLoadingFiles(true);
      try {
        let userFiles: FileMeta[];

        // Get files based on view and folder
        if (view === "full") {
          // In full view, filter by current folder
          userFiles = await getFilesInFolder(userEmail, currentFolderId);

          // Also get folders in current directory
          const allFolders = await getFoldersForUser(userEmail);
          const currentFolders = allFolders.filter(
            (f) => (f.parentId || null) === currentFolderId
          );
          setFolders(currentFolders);
        } else {
          // For compact/recent views, get all files (no folder filtering)
          userFiles = await getAllFilesForUser(userEmail);
        }

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
        setFolders([]);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFiles();
  }, [userEmail, view, refreshKey, currentFolderId, refreshFileListKey]);

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

      // Check authentication via backend token
      const { getGoogleAccessToken } = await import("../../utils/gapiInit");
      const token = await getGoogleAccessToken();
      if (!token) {
        toast.error("Authentication error", {
          description: "Please sign in again",
        });
        setDownloadingFileId(null);
        return;
      }

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

    // Check for encryption key before allowing deletion
    const key = await getStoredKey();
    if (!key) {
      toast.error("Encryption key required", {
        description: "You need your encryption key to delete files. Please upload it first.",
      });
      setShowDeleteConfirm(false);
      setFileToDelete(null);
      return;
    }

    const { id: fileId, name: fileName } = fileToDelete;
    let deleteToastId: string | number | undefined;
    let deleteSuccess = false;

    try {
      deleteToastId = toast.loading(`Deleting ${fileName}...`);

      const { getGoogleAccessToken } = await import("../../utils/gapiInit");
      const token = await getGoogleAccessToken();
      if (!token) {
        throw new Error("Authentication error");
      }
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
      const updatedFolders = await getFoldersForUser(userEmail);
      setAllUserFiles(updatedFiles);
      setFilteredFiles(updatedFiles);

      console.log("[FileList] Deletion complete, syncing metadata...");
      await sendToGoogleDrive(updatedFiles, updatedFolders);

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

  const handlePreview = (
    fileId: string,
    fileName: string,
    mimeType: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (isPreviewable(mimeType)) {
      setPreviewFile({ id: fileId, name: fileName, mimeType });
    }
  };

  if (view === "compact" || view === "recent") {
    return (
      <div className="p-1">
        {isLoadingFiles ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            Loading...
          </p>
        ) : (filteredFiles.length > 0 || folders.length > 0) ? (
          <div className="space-y-3">
            {/* Folders first (only in full view) */}
            {view === "full" && folders.length > 0 && (
              <div className="space-y-2">
                {folders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    userEmail={userEmail!}
                    onDeleted={() => setRefreshFileListKey(prev => prev + 1)}
                  />
                ))}
              </div>
            )}

            {/* Files */}
            {filteredFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filteredFiles.map((file) => {
              const canPreview = isPreviewable(file.mimeType);
              return (
                <Button
                  key={file.id}
                  onClick={() =>
                    canPreview
                      ? setPreviewFile({
                          id: file.id,
                          name: file.name,
                          mimeType: file.mimeType,
                        })
                      : downloadAndDecryptFile(file.id, file.name)
                  }
                  title={canPreview ? `Preview ${file.name}` : `Download ${file.name}`}
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
                        {canPreview && (
                          <button
                            onClick={(e) =>
                              handlePreview(
                                file.id,
                                file.name,
                                file.mimeType,
                                e
                              )
                            }
                            className="text-primary hover:text-primary/80 focus:outline-none p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            aria-label="Preview file"
                            title="Preview file"
                          >
                            <Eye size={14} strokeWidth={1.5} />
                          </button>
                        )}
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
              );
            })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-left text-xs text-muted-foreground py-4">
            {view === "recent" ? "No recent uploads" : "No files or folders"}
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

        {previewFile && (
          <FilePreviewDialog
            fileId={previewFile.id}
            fileName={previewFile.name}
            mimeType={previewFile.mimeType}
            open={!!previewFile}
            onOpenChange={(open) => !open && setPreviewFile(null)}
            onDownload={() => {
              downloadAndDecryptFile(previewFile.id, previewFile.name);
              setPreviewFile(null);
            }}
          />
        )}
      </div>
    );
  }

  // Full view - show folders and files in a list
  return (
    <div className="space-y-4">
      {isLoadingFiles ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <div className="space-y-2">
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  userEmail={userEmail!}
                  onDeleted={() => setRefreshFileListKey((prev) => prev + 1)}
                />
              ))}
            </div>
          )}

          {/* Files */}
          {filteredFiles.length > 0 && (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const canPreview = isPreviewable(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                  >
                    {/* File name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(file.uploadedDate).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {canPreview && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setPreviewFile({
                              id: file.id,
                              name: file.name,
                              mimeType: file.mimeType,
                            })
                          }
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Preview file"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadAndDecryptFile(file.id, file.name)}
                        disabled={downloadingFileId === file.id}
                        title="Download file"
                      >
                        {downloadingFileId === file.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <span>📥</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => deleteFileHandler(file.id, file.name, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && filteredFiles.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No files or folders. Upload a file or create a folder to get started.
            </p>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete "${fileToDelete?.name || "this file"}"?`}
        description="Are you sure you want to delete this file? This action cannot be undone."
        onConfirm={performDelete}
        confirmText="Delete"
      />

      {/* Preview Dialog */}
      {previewFile && (
        <FilePreviewDialog
          fileId={previewFile.id}
          fileName={previewFile.name}
          mimeType={previewFile.mimeType}
          open={!!previewFile}
          onOpenChange={(open) => !open && setPreviewFile(null)}
          onDownload={() => {
            downloadAndDecryptFile(previewFile.id, previewFile.name);
            setPreviewFile(null);
          }}
        />
      )}
    </div>
  );
};
