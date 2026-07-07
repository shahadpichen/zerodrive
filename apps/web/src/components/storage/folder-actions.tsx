import React, { useState } from "react";
import { MoreVertical, Trash2, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ConfirmationDialog } from "./confirmation-dialog";
import type { FolderMeta } from "../../utils/dexieDB";
import { deleteFolder, renameFolder } from "../../utils/folderOperations";

interface FolderActionsProps {
  folder: FolderMeta;
  userEmail: string;
  onChanged: () => void;
  // "menu" = kebab dropdown (grid card); "inline" = rename/delete icon buttons (list row)
  variant?: "menu" | "inline";
}

export function FolderActions({
  folder,
  userEmail,
  onChanged,
  variant = "menu",
}: FolderActionsProps) {
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const openRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(folder.name);
    setShowRename(true);
  };

  const openDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === folder.name) {
      setShowRename(false);
      return;
    }
    setIsRenaming(true);
    const ok = await renameFolder(folder.id, folder.name, newName, userEmail);
    setIsRenaming(false);
    if (ok) {
      setShowRename(false);
      onChanged();
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const ok = await deleteFolder(folder.id, folder.name, userEmail, true);
    setIsDeleting(false);
    if (ok) onChanged();
  };

  return (
    <>
      {variant === "menu" ? (
        // modal={false} avoids the Radix body pointer-events lock when a
        // dialog is opened from a menu item
        <DropdownMenu modal={false}>
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
            <DropdownMenuItem onClick={openRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={openDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={openRename}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Rename folder"
            title="Rename folder"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={openDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete folder"
            title="Delete folder"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRenaming) handleRename();
              }}
              autoFocus
              disabled={isRenaming}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRename(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={
                !newName.trim() || newName.trim() === folder.name || isRenaming
              }
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
