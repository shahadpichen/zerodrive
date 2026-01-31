import React, { useState } from "react";
import { Folder, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ConfirmationDialog } from "./confirmation-dialog";
import type { FolderMeta } from "../../utils/dexieDB";
import { deleteFolder } from "../../utils/folderOperations";
import { useFolderContext } from "./folder-context";

interface FolderItemProps {
  folder: FolderMeta;
  userEmail: string;
  onDeleted: () => void;
}

export function FolderItem({ folder, userEmail, onDeleted }: FolderItemProps) {
  const { navigateToFolder, setCurrentPath, currentPath } = useFolderContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      true // Force delete - files will be moved to root
    );
    setIsDeleting(false);

    if (success) {
      onDeleted();
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={handleNavigate}
        >
          <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <span className="font-medium">{folder.name}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
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
