import React, { useState, useEffect } from "react";
import {
  FileMeta,
  FolderMeta,
  getAllFilesForUser,
  deleteFileFromDB,
  sendToGoogleDrive,
  getFilesInFolder,
  getFoldersForUser,
} from "../../utils/dexieDB";

import { decryptFile } from "../../utils/decryptFile";
import {
  Trash2,
  Eye,
  Search,
  LayoutGrid,
  List as ListIcon,
  ArrowDownUp,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  MimeTypeCategory,
  mimeTypeCategories,
  getFileIconPath,
} from "../../lib/mime-types";
import { getStoredKey } from "../../utils/cryptoUtils";
import { toast } from "sonner";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Button } from "../ui/button";
import { FilePreviewDialog } from "./file-preview-dialog";
import { isPreviewable } from "../../utils/filePreview";
import { useFolderContext } from "./folder-context";
import { FolderItem } from "./folder-item";
import { FolderBreadcrumb } from "./folder-breadcrumb";

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
    return {
      currentFolderId: null,
      currentPath: [] as FolderMeta[],
      navigateToFolder: () => {},
      navigateUp: () => {},
      goToRoot: () => {},
      setCurrentPath: () => {},
    };
  }
}

export const FileList: React.FC<FileListProps> = ({
  view = "full",
  refreshKey,
  userEmail: userEmailProp,
}) => {
  const { currentFolderId, currentPath, navigateToFolder, setCurrentPath } =
    useSafeFolderContext();
  const [allUserFiles, setAllUserFiles] = useState<FileMeta[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMeta[]>([]);
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const userEmail = userEmailProp || null;
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [filter, setFilter] = useState<MimeTypeCategory | "All Files">(
    "All Files",
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<"name" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [refreshFileListKey, setRefreshFileListKey] = useState(0);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!userEmail) {
        console.log(
          `[FileList - ${view}] Waiting for user email to fetch files.`,
        );
        setAllUserFiles([]);
        setFilteredFiles([]);
        setFolders([]);
        setIsLoadingFiles(false);
        return;
      }

      console.log(
        `[FileList - ${view}] Fetching files for ${userEmail}, Key: ${refreshKey}, FolderId: ${currentFolderId}`,
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
            (f) => (f.parentId || null) === currentFolderId,
          );
          setFolders(currentFolders);
        } else {
          // For compact/recent views, get all files (no folder filtering)
          userFiles = await getAllFilesForUser(userEmail);
        }

        console.log(
          `[FileList - ${view}] Found ${userFiles.length} files in DB for ${userEmail}.`,
        );

        let displayFiles = userFiles;
        if (view === "recent") {
          displayFiles = [...userFiles]
            .sort(
              (a, b) =>
                new Date(b.uploadedDate).getTime() -
                new Date(a.uploadedDate).getTime(),
            )
            .slice(0, 5);
        }

        setAllUserFiles(displayFiles);
        setFilteredFiles(displayFiles);
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
      `[FileList - ${view}] Applying filters. Current filter: ${filter}, Query: ${searchQuery}`,
    );
    let results = allUserFiles;

    if (filter !== "All Files") {
      if (filter === "Others") {
        results = results.filter(
          (file) =>
            !Object.values(mimeTypeCategories).flat().includes(file.mimeType),
        );
      } else {
        results = results.filter((file) =>
          mimeTypeCategories[filter as MimeTypeCategory]?.includes(
            file.mimeType,
          ),
        );
      }
    }

    if (searchQuery) {
      results = results.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    results = [...results].sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? a.name.localeCompare(b.name)
          : new Date(a.uploadedDate).getTime() -
            new Date(b.uploadedDate).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    setFilteredFiles(results);
    console.log(
      `[FileList - ${view}] Filtering applied, ${results.length} files shown.`,
    );
  }, [filter, searchQuery, sortKey, sortDir, allUserFiles, view]);

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
        },
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
      } catch (decryptionError: unknown) {
        console.error("Decryption error:", decryptionError);

        const errorMessage =
          decryptionError instanceof Error
            ? decryptionError.message
            : "Unknown decryption error";

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
    } catch (error: unknown) {
      console.error("Error during file download or decryption:", error);
      toast.error("Error during file download", {
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
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
        description:
          "You need your encryption key to delete files. Please upload it first.",
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
        },
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
    } catch (error: unknown) {
      console.error("Error during delete process:", error);
      toast.error(`Failed to delete ${fileName}`, {
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
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
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setFileToDelete({ id: fileId, name: fileName });
    setShowDeleteConfirm(true);
  };

  const handlePreview = (
    fileId: string,
    fileName: string,
    mimeType: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setPreviewFile({ id: fileId, name: fileName, mimeType });
  };

  if (view === "compact" || view === "recent") {
    return (
      <div className="p-1">
        {isLoadingFiles ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            Loading...
          </p>
        ) : filteredFiles.length > 0 ? (
          <div className="space-y-3">
            {/* Files */}
            {filteredFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filteredFiles.map((file) => {
                  const canPreview = isPreviewable(file.mimeType, file.name);
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
                      title={
                        canPreview
                          ? `Preview ${file.name}`
                          : `Download ${file.name}`
                      }
                      className="w-fit group pr-3"
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden flex-grow min-w-0 max-w-full">
                        <img
                          src={getFileIconPath(file.mimeType)}
                          alt=""
                          className="w-5 h-5 flex-shrink-0"
                        />
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
                                    e,
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
                                {new Date(
                                  file.uploadedDate,
                                ).toLocaleDateString()}
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

  // Full view - toolbar + grid/list of folders and files
  const visibleFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : folders;

  const filterChips: {
    label: string;
    value: MimeTypeCategory | "All Files";
  }[] = [
    { label: "All", value: "All Files" },
    { label: "Images", value: "Images" },
    { label: "PDFs", value: "PDFs" },
    { label: "Videos", value: "Videos" },
  ];

  const sortLabels: Record<string, string> = {
    "date-desc": "Newest",
    "date-asc": "Oldest",
    "name-asc": "Name A–Z",
    "name-desc": "Name Z–A",
  };
  const currentSortLabel = sortLabels[`${sortKey}-${sortDir}`];

  const typeLabel = (mimeType: string): string => {
    const entry = (
      Object.entries(mimeTypeCategories) as [MimeTypeCategory, string[]][]
    ).find(([, list]) => list.includes(mimeType));
    return entry ? entry[0] : "File";
  };

  const isEmpty = visibleFolders.length === 0 && filteredFiles.length === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search + type filter + sort + view toggle */}
      <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 border px-3 py-2 sm:w-80">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setFilter(chip.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                filter === chip.value
                  ? "border border-foreground bg-muted font-semibold"
                  : "border border-border text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {chip.label}
            </button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 border px-3 py-1.5 text-xs">
                <ArrowDownUp className="h-3.5 w-3.5" />
                {currentSortLabel}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSortKey("date");
                  setSortDir("desc");
                }}
              >
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortKey("date");
                  setSortDir("asc");
                }}
              >
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortKey("name");
                  setSortDir("asc");
                }}
              >
                Name A–Z
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortKey("name");
                  setSortDir("desc");
                }}
              >
                Name Z–A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex border">
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={`p-2 ${
                viewMode === "grid"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={`border-l p-2 ${
                viewMode === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb — only inside a folder; doubles as a move-to-parent drop target */}
      {userEmail && currentPath.length > 0 && (
        <FolderBreadcrumb
          userEmail={userEmail}
          onFileMoved={() => setRefreshFileListKey((prev) => prev + 1)}
        />
      )}

      {isLoadingFiles ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : isEmpty ? (
        <p className="text-center text-muted-foreground py-8">
          {searchQuery
            ? `No files match "${searchQuery}".`
            : "No files or folders. Upload a file or create a folder to get started."}
        </p>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {visibleFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              userEmail={userEmail!}
              onDeleted={() => setRefreshFileListKey((prev) => prev + 1)}
              onFileMoved={() => setRefreshFileListKey((prev) => prev + 1)}
            />
          ))}

          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`relative flex flex-col items-center gap-2 p-4 cursor-pointer group ${
                draggingFileId === file.id ? "opacity-50" : ""
              }`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/x-file-id", file.id);
                e.dataTransfer.setData("text/x-file-name", file.name);
                e.dataTransfer.effectAllowed = "move";
                setDraggingFileId(file.id);
              }}
              onDragEnd={() => setDraggingFileId(null)}
              onClick={() => handlePreview(file.id, file.name, file.mimeType)}
              title={file.name}
            >
              <button
                onClick={(e) => deleteFileHandler(file.id, file.name, e)}
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                aria-label="Delete file"
                title="Delete file"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <img
                src={getFileIconPath(file.mimeType)}
                alt=""
                className="w-12 h-12"
              />

              <p className="text-sm font-medium text-center w-full truncate">
                {file.name}
              </p>

              <p className="text-xs text-muted-foreground">
                {new Date(file.uploadedDate).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-3 font-medium">Name</th>
                <th className="py-2.5 pr-3 font-medium">Type</th>
                <th className="py-2.5 pr-3 font-medium">Modified</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visibleFolders.map((folder) => (
                <tr
                  key={folder.id}
                  className="border-b cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setCurrentPath([...currentPath, folder]);
                    navigateToFolder(folder.id);
                  }}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <img src="/folder.png" alt="" className="h-5 w-5" />
                      <span className="font-medium truncate">
                        {folder.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">Folder</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {new Date(folder.createdDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5"></td>
                </tr>
              ))}

              {filteredFiles.map((file) => {
                const canPreview = isPreviewable(file.mimeType, file.name);
                return (
                  <tr
                    key={file.id}
                    className="border-b cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      canPreview
                        ? handlePreview(file.id, file.name, file.mimeType)
                        : downloadAndDecryptFile(file.id, file.name)
                    }
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getFileIconPath(file.mimeType)}
                          alt=""
                          className="h-5 w-5"
                        />
                        <span className="truncate">{file.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {typeLabel(file.mimeType)}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {new Date(file.uploadedDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        {canPreview && (
                          <button
                            onClick={(e) =>
                              handlePreview(
                                file.id,
                                file.name,
                                file.mimeType,
                                e,
                              )
                            }
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Preview file"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) =>
                            deleteFileHandler(file.id, file.name, e)
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
