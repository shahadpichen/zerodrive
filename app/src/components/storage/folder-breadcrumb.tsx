import React from "react";
import { Home, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useFolderContext } from "./folder-context";

export function FolderBreadcrumb() {
  const { currentPath, navigateToFolder, goToRoot } = useFolderContext();

  return (
    <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={goToRoot}
        className="flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span>Root</span>
      </Button>

      {currentPath.map((folder) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToFolder(folder.id)}
            className="whitespace-nowrap"
          >
            {folder.name}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}
