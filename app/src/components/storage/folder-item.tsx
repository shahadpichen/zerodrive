import React, { useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ConfirmationDialog } from "./confirmation-dialog";
import type { FolderMeta } from "../../utils/dexieDB";
import { deleteFolder, moveFile } from "../../utils/folderOperations";
import { useFolderContext } from "./folder-context";

interface FolderItemProps {
  folder: FolderMeta;
  userEmail: string;
  onDeleted: () => void;
  onFileMoved?: () => void;
}

export function FolderItem({ folder, userEmail, onDeleted, onFileMoved }: FolderItemProps) {
  const { navigateToFolder, setCurrentPath, currentPath } = useFolderContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleNavigate = () => {
    // Add this folder to the path
    setCurrentPath([...currentPath, folder]);
    navigateToFolder(folder.id);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteFolder(
      folder.id,
      folder.name,
      userEmail,
      true, // Force delete - files will be moved to root
    );
    setIsDeleting(false);

    if (success) {
      onDeleted();
    }
  };

  return (
    <>
      <div
        className={`relative flex flex-col items-center gap-2 p-4 cursor-pointer group transition-all ${
          dragOver ? "ring-2 ring-primary bg-primary/10 scale-105" : ""
        }`}
        onClick={handleNavigate}
        title={folder.name}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const fileId = e.dataTransfer.getData("text/x-file-id");
          const fileName = e.dataTransfer.getData("text/x-file-name");
          if (!fileId || !fileName) return;
          const success = await moveFile(fileId, fileName, folder.id, userEmail);
          if (success) {
            onFileMoved?.();
          }
        }}
      >
        {/* Delete menu - top right, visible on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Large folder icon */}
        <img src="/folder.png" alt="" className="w-12 h-12" />

        {/* Folder name */}
        <p className="text-sm font-medium text-center w-full truncate">
          {folder.name}
        </p>
      </div>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete "${folder.name}"?`}
        description="Are you sure you want to delete this folder? Any files inside will be moved to the root folder. This action cannot be undone."
        onConfirm={handleDelete}
        confirmText={isDeleting ? "Deleting..." : "Delete"}
      />
    </>
  );
}
