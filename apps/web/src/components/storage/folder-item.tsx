import React, { useState } from "react";
import type { FolderMeta } from "../../utils/dexieDB";
import { moveFile } from "../../utils/folderOperations";
import { useFolderContext } from "./folder-context";
import { FolderActions } from "./folder-actions";
import { showVaultMetadataWriteBlockedToast } from "../../utils/vaultMetadataWriteGuard";

interface FolderItemProps {
  folder: FolderMeta;
  userEmail: string;
  // Called whenever the folder is mutated (renamed or deleted) so the list refreshes
  onDeleted: () => void;
  onFileMoved?: () => void;
  canWriteVaultMetadata?: boolean;
}

export function FolderItem({
  folder,
  userEmail,
  onDeleted,
  onFileMoved,
  canWriteVaultMetadata = true,
}: FolderItemProps) {
  const { navigateToFolder, setCurrentPath, currentPath } = useFolderContext();
  const [dragOver, setDragOver] = useState(false);

  const handleNavigate = () => {
    setCurrentPath([...currentPath, folder]);
    navigateToFolder(folder.id);
  };

  return (
    <div
      className={`relative flex flex-col items-center gap-2 p-4 cursor-pointer group transition-all ${
        dragOver ? "ring-2 ring-primary bg-primary/10 scale-105" : ""
      }`}
      onClick={handleNavigate}
      title={folder.name}
      onDragOver={(e) => {
        if (!canWriteVaultMetadata) return;
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
        if (!canWriteVaultMetadata) {
          showVaultMetadataWriteBlockedToast();
          return;
        }
        const success = await moveFile(fileId, fileName, folder.id, userEmail);
        if (success) onFileMoved?.();
      }}
    >
      {/* Actions menu - top right, visible on hover */}
      <div
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <FolderActions
          folder={folder}
          userEmail={userEmail}
          onChanged={onDeleted}
          variant="menu"
          canWriteVaultMetadata={canWriteVaultMetadata}
        />
      </div>

      {/* Large folder icon */}
      <img src="/folder.png" alt="" className="w-12 h-12" />

      {/* Folder name */}
      <p className="text-sm font-medium text-center w-full truncate">
        {folder.name}
      </p>
    </div>
  );
}
