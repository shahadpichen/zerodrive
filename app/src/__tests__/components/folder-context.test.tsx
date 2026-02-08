/**
 * Unit Tests for FolderContext
 * Tests folder navigation context provider and hooks
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { FolderProvider, useFolderContext } from '../../components/storage/folder-context';
import type { FolderMeta } from '../../utils/dexieDB';

describe('FolderContext', () => {
  const mockFolder1: FolderMeta = {
    id: 'folder-1',
    name: 'Documents',
    parentId: null,
    userEmail: 'test@example.com',
    createdDate: new Date('2024-01-01'),
  };

  const mockFolder2: FolderMeta = {
    id: 'folder-2',
    name: 'Photos',
    parentId: 'folder-1',
    userEmail: 'test@example.com',
    createdDate: new Date('2024-01-02'),
  };

  const mockFolder3: FolderMeta = {
    id: 'folder-3',
    name: 'Work',
    parentId: 'folder-2',
    userEmail: 'test@example.com',
    createdDate: new Date('2024-01-03'),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FolderProvider>{children}</FolderProvider>
  );

  describe('Initial State', () => {
    it('should have null currentFolderId by default', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      expect(result.current.currentFolderId).toBeNull();
    });

    it('should have empty currentPath by default', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      expect(result.current.currentPath).toEqual([]);
    });

    it('should provide all context methods', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      expect(result.current.navigateToFolder).toBeDefined();
      expect(result.current.navigateUp).toBeDefined();
      expect(result.current.goToRoot).toBeDefined();
      expect(result.current.setCurrentPath).toBeDefined();
    });
  });

  describe('navigateToFolder', () => {
    it('should update currentFolderId when navigating to a folder', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.navigateToFolder('folder-1');
      });

      expect(result.current.currentFolderId).toBe('folder-1');
    });

    it('should update currentFolderId to null when navigating to root', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.navigateToFolder('folder-1');
      });

      expect(result.current.currentFolderId).toBe('folder-1');

      act(() => {
        result.current.navigateToFolder(null);
      });

      expect(result.current.currentFolderId).toBeNull();
    });

    it('should not change currentPath when navigating', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1]);
      });

      const pathBefore = result.current.currentPath;

      act(() => {
        result.current.navigateToFolder('folder-2');
      });

      expect(result.current.currentPath).toBe(pathBefore);
    });

    it('should handle multiple folder navigations', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.navigateToFolder('folder-1');
      });
      expect(result.current.currentFolderId).toBe('folder-1');

      act(() => {
        result.current.navigateToFolder('folder-2');
      });
      expect(result.current.currentFolderId).toBe('folder-2');

      act(() => {
        result.current.navigateToFolder('folder-3');
      });
      expect(result.current.currentFolderId).toBe('folder-3');
    });
  });

  describe('setCurrentPath', () => {
    it('should update currentPath with single folder', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1]);
      });

      expect(result.current.currentPath).toEqual([mockFolder1]);
    });

    it('should update currentPath with multiple folders', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      const path = [mockFolder1, mockFolder2, mockFolder3];

      act(() => {
        result.current.setCurrentPath(path);
      });

      expect(result.current.currentPath).toEqual(path);
    });

    it('should clear currentPath with empty array', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2]);
      });

      expect(result.current.currentPath.length).toBe(2);

      act(() => {
        result.current.setCurrentPath([]);
      });

      expect(result.current.currentPath).toEqual([]);
    });

    it('should replace existing path when called multiple times', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1]);
      });
      expect(result.current.currentPath).toEqual([mockFolder1]);

      act(() => {
        result.current.setCurrentPath([mockFolder2, mockFolder3]);
      });
      expect(result.current.currentPath).toEqual([mockFolder2, mockFolder3]);
    });
  });

  describe('navigateUp', () => {
    it('should navigate to parent folder when path has multiple items', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2]);
        result.current.navigateToFolder('folder-2');
      });

      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.currentFolderId).toBe('folder-1');
      expect(result.current.currentPath).toEqual([mockFolder1]);
    });

    it('should navigate to root when path has single item', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1]);
        result.current.navigateToFolder('folder-1');
      });

      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });

    it('should do nothing when already at root', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      expect(result.current.currentPath).toEqual([]);
      expect(result.current.currentFolderId).toBeNull();

      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });

    it('should handle deep navigation up multiple levels', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2, mockFolder3]);
        result.current.navigateToFolder('folder-3');
      });

      // Navigate up once
      act(() => {
        result.current.navigateUp();
      });
      expect(result.current.currentFolderId).toBe('folder-2');
      expect(result.current.currentPath).toEqual([mockFolder1, mockFolder2]);

      // Navigate up again
      act(() => {
        result.current.navigateUp();
      });
      expect(result.current.currentFolderId).toBe('folder-1');
      expect(result.current.currentPath).toEqual([mockFolder1]);

      // Navigate up to root
      act(() => {
        result.current.navigateUp();
      });
      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });
  });

  describe('goToRoot', () => {
    it('should reset to root when at nested folder', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2]);
        result.current.navigateToFolder('folder-2');
      });

      act(() => {
        result.current.goToRoot();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });

    it('should do nothing when already at root', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      expect(result.current.currentFolderId).toBeNull();

      act(() => {
        result.current.goToRoot();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });

    it('should clear path from any depth', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2, mockFolder3]);
        result.current.navigateToFolder('folder-3');
      });

      act(() => {
        result.current.goToRoot();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });
  });

  describe('Context Requirement', () => {
    it('should throw error when useFolderContext is used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useFolderContext());
      }).toThrow('useFolderContext must be used within a FolderProvider');

      console.error = originalError;
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      // Navigate to folder 1
      act(() => {
        result.current.setCurrentPath([mockFolder1]);
        result.current.navigateToFolder('folder-1');
      });

      // Navigate to folder 2
      act(() => {
        result.current.setCurrentPath([mockFolder1, mockFolder2]);
        result.current.navigateToFolder('folder-2');
      });

      expect(result.current.currentFolderId).toBe('folder-2');
      expect(result.current.currentPath).toEqual([mockFolder1, mockFolder2]);

      // Go back to root
      act(() => {
        result.current.goToRoot();
      });

      expect(result.current.currentFolderId).toBeNull();
      expect(result.current.currentPath).toEqual([]);
    });

    it('should handle path updates without navigation', () => {
      const { result } = renderHook(() => useFolderContext(), { wrapper });

      act(() => {
        result.current.navigateToFolder('folder-1');
      });

      expect(result.current.currentFolderId).toBe('folder-1');
      expect(result.current.currentPath).toEqual([]);

      act(() => {
        result.current.setCurrentPath([mockFolder1]);
      });

      expect(result.current.currentFolderId).toBe('folder-1');
      expect(result.current.currentPath).toEqual([mockFolder1]);
    });
  });
});
