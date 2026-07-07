import React, { createContext, useContext, useState, useCallback } from "react";
import type { FolderMeta } from "../../utils/dexieDB";

interface FolderContextType {
  currentFolderId: string | null; // null = root
  currentPath: FolderMeta[]; // Breadcrumb path from root to current
  navigateToFolder: (folderId: string | null) => void;
  navigateUp: () => void;
  goToRoot: () => void;
  setCurrentPath: (path: FolderMeta[]) => void;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

export function FolderProvider({ children }: { children: React.ReactNode }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<FolderMeta[]>([]);

  const navigateToFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    // Note: The calling component should update currentPath when navigating
    // since it has access to folder metadata
  }, []);

  const navigateUp = useCallback(() => {
    if (currentPath.length > 0) {
      // Navigate to parent of current folder
      const parent = currentPath[currentPath.length - 2];
      setCurrentFolderId(parent?.id || null);
      setCurrentPath(currentPath.slice(0, -1));
    }
  }, [currentPath]);

  const goToRoot = useCallback(() => {
    setCurrentFolderId(null);
    setCurrentPath([]);
  }, []);

  return (
    <FolderContext.Provider
      value={{
        currentFolderId,
        currentPath,
        navigateToFolder,
        navigateUp,
        goToRoot,
        setCurrentPath,
      }}
    >
      {children}
    </FolderContext.Provider>
  );
}

export function useFolderContext() {
  const context = useContext(FolderContext);
  if (!context) {
    throw new Error("useFolderContext must be used within a FolderProvider");
  }
  return context;
}
