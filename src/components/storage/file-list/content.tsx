import React, { useState } from "react";
import {
  FileMeta,
  fetchAndStoreFileMetadata,
  deleteFiles,
} from "../../../utils/dexieDB";
import { Button } from "../../ui/button";
import { Loader2, Trash2, Download } from "lucide-react";
import { FaRegFileLines } from "react-icons/fa6";
import { MdOutlineCloudUpload } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import Spinner from "../../ui/spinner";
import { DataTable } from "../../ui/data-table";
import { columns } from "./columns";
import { iconMap } from "../../../lib/mime-types";
import { DeleteDialog } from "../../ui/delete-dialog";

interface ContentProps {
  isLoadingFiles: boolean;
  filteredFiles: FileMeta[];
  isOn: boolean;
  downloadAndDecryptFile: (fileId: string, fileName: string) => void;
  downloadingFileId: string | null;
  droppedFiles: File[];
  loading: boolean;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  uploadDroppedFiles: () => void;
  handleCancelUpload: () => void;
}

export const FileListContent: React.FC<ContentProps> = ({
  isLoadingFiles,
  filteredFiles,
  isOn,
  downloadAndDecryptFile,
  downloadingFileId,
  droppedFiles,
  loading,
  handleDrop,
  handleDragOver,
  uploadDroppedFiles,
  handleCancelUpload,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);
  const [fileToDelete, setFileToDelete] = React.useState<FileMeta | null>(null);

  const getIconForMimeType = (mimeType: string) => {
    return iconMap[mimeType] || <FaRegFileLines />;
  };

  const handleDeleteClick = (file: FileMeta, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the download
    setFileToDelete(file);
    setOpenDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    const success = await deleteFiles([fileToDelete.id]);

    if (success) {
      window.location.reload();
    }

    setIsDeleting(false);
    setOpenDeleteDialog(false);
    setFileToDelete(null);
  };

  const handleDownloadClick = (file: FileMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadAndDecryptFile(file.id, file.name);
  };

  if (isLoadingFiles) {
    return (
      <div
        className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4"
        style={{ height: "calc(100vh - 34vh)" }}
      >
        <Spinner />
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div
        className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4"
        style={{ height: "calc(100vh - 34vh)" }}
      >
        <p>No files available</p>
      </div>
    );
  }

  return (
    <div
      className="h-full p-4 w-full rounded-lg mt-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {isOn ? (
        <DataTable
          columns={columns}
          data={filteredFiles}
          meta={{
            updateData: (newData: FileMeta[]) => {
              fetchAndStoreFileMetadata();
            },
            refetch: fetchAndStoreFileMetadata,
          }}
        />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredFiles.map((file) => (
            <li key={file.id} className="relative group">
              <div className="h-36 w-full md:h-40 flex flex-col gap-3 overflow-hidden rounded-md bg-zinc-300/10 hover:bg-zinc-400/10 cursor-default p-2">
                <div className="absolute top-2 left-4 flex justify-between w-[calc(100%-1rem)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="h-8 w-8 text-blue-500 hover:text-blue-600"
                    onClick={(e) => handleDownloadClick(file, e)}
                    disabled={downloadingFileId === file.id}
                  >
                    {downloadingFileId === file.id ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={(e) => handleDeleteClick(file, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="h-[70%] rounded-xl text-6xl w-full flex items-center justify-center">
                  {getIconForMimeType(file.mimeType)}
                </div>
                <div className="h-[30%] max-w-full px-2">
                  <p className="flex text-sm items-center truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {file.uploadedDate?.toLocaleString().split(",")[0]}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DeleteDialog
        open={openDeleteDialog}
        onOpenChange={setOpenDeleteDialog}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        itemCount={fileToDelete ? 1 : 0}
      />

      {droppedFiles.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            onClick={uploadDroppedFiles}
            variant="outline"
            className="absolute flex flex-col text-2xl font-semibold w-full h-full bg-black/20 top-0 hover:bg-black/25"
            disabled={loading}
          >
            <MdOutlineCloudUpload className="text-8xl" />
            {loading ? "Uploading..." : "Click to Upload Files"}
          </Button>
          <Button
            onClick={handleCancelUpload}
            variant="ghost"
            className="absolute top-2 right-2 hover:bg-transparent"
            disabled={loading}
          >
            <RxCross2 className="text-2xl" />
          </Button>
        </div>
      )}
    </div>
  );
};
