import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useFolderContext } from "./folder-context";
import { moveFile } from "../../utils/folderOperations";
import { showVaultMetadataWriteBlockedToast } from "../../utils/vaultMetadataWriteGuard";

interface FolderBreadcrumbProps {
  userEmail: string;
  onFileMoved: () => void;
  canWriteVaultMetadata?: boolean;
}

export function FolderBreadcrumb({
  userEmail,
  onFileMoved,
  canWriteVaultMetadata = true,
}: FolderBreadcrumbProps) {
  const { currentPath, setCurrentPath, navigateToFolder, goToRoot } =
    useFolderContext();
  const [dragOverId, setDragOverId] = useState<string | "root" | null>(null);

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverId(null);
    const fileId = e.dataTransfer.getData("text/x-file-id");
    const fileName = e.dataTransfer.getData("text/x-file-name");
    if (!fileId || !fileName) return;
    if (!canWriteVaultMetadata) {
      showVaultMetadataWriteBlockedToast();
      return;
    }
    const success = await moveFile(fileId, fileName, folderId, userEmail);
    if (success) onFileMoved();
  };

  const isLastItem = (index: number) => index === currentPath.length - 1;

  return (
    <div className="flex items-center gap-2 text-sm overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={goToRoot}
        className={`flex items-center gap-1 ${dragOverId === "root" ? "ring-2 ring-primary bg-primary/10" : ""}`}
        onDragOver={(e) => {
          if (!canWriteVaultMetadata) return;
          e.preventDefault();
          setDragOverId("root");
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(e, null)}
      >
        <span>Root</span>
      </Button>

      {currentPath.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentPath(currentPath.slice(0, index + 1));
              navigateToFolder(folder.id);
            }}
            className={`whitespace-nowrap ${!isLastItem(index) && dragOverId === folder.id ? "ring-2 ring-primary bg-primary/10" : ""}`}
            {...(!isLastItem(index)
              ? {
                  onDragOver: (e: React.DragEvent) => {
                    if (!canWriteVaultMetadata) return;
                    e.preventDefault();
                    setDragOverId(folder.id);
                  },
                  onDragLeave: () => setDragOverId(null),
                  onDrop: (e: React.DragEvent) => handleDrop(e, folder.id),
                }
              : {})}
          >
            {folder.name}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}
