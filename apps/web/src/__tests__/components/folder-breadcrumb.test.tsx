/**
 * Unit Tests for FolderBreadcrumb Component
 * Tests breadcrumb navigation and drag-and-drop functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderBreadcrumb } from '../../components/storage/folder-breadcrumb';
import { FolderProvider } from '../../components/storage/folder-context';
import { moveFile } from '../../utils/folderOperations';
import type { FolderMeta } from '../../utils/dexieDB';

// Mock dependencies
jest.mock('../../utils/folderOperations');
jest.mock('../../utils/logger');

const mockMoveFile = moveFile as jest.MockedFunction<typeof moveFile>;

describe('FolderBreadcrumb Component', () => {
  const testUser = 'test@example.com';
  const mockOnFileMoved = jest.fn();

  const mockFolder1: FolderMeta = {
    id: 'folder-1',
    name: 'Documents',
    parentId: null,
    userEmail: testUser,
    createdDate: new Date('2024-01-01'),
  };

  const mockFolder2: FolderMeta = {
    id: 'folder-2',
    name: 'Photos',
    parentId: 'folder-1',
    userEmail: testUser,
    createdDate: new Date('2024-01-02'),
  };

  const mockFolder3: FolderMeta = {
    id: 'folder-3',
    name: 'Work',
    parentId: 'folder-2',
    userEmail: testUser,
    createdDate: new Date('2024-01-03'),
  };

  const renderWithContext = (
    initialPath: FolderMeta[] = [],
    initialFolderId: string | null = null
  ) => {
    return render(
      <FolderProvider>
        <TestWrapper
          initialPath={initialPath}
          initialFolderId={initialFolderId}
          userEmail={testUser}
          onFileMoved={mockOnFileMoved}
        />
      </FolderProvider>
    );
  };

  // Helper component to set initial context state
  const TestWrapper = ({
    initialPath,
    initialFolderId,
    userEmail,
    onFileMoved,
  }: {
    initialPath: FolderMeta[];
    initialFolderId: string | null;
    userEmail: string;
    onFileMoved: () => void;
  }) => {
    const { setCurrentPath, navigateToFolder } = require('../../components/storage/folder-context').useFolderContext();

    React.useEffect(() => {
      setCurrentPath(initialPath);
      if (initialFolderId) {
        navigateToFolder(initialFolderId);
      }
    }, []);

    return <FolderBreadcrumb userEmail={userEmail} onFileMoved={onFileMoved} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render root button at root level', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /root/i })).toBeInTheDocument();
    });

    it('should render root button with home icon', () => {
      renderWithContext();

      const rootButton = screen.getByRole('button', { name: /root/i });
      expect(rootButton.querySelector('svg')).toBeInTheDocument();
    });

    it('should render single folder in breadcrumb', () => {
      renderWithContext([mockFolder1], 'folder-1');

      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('should render multiple folders in breadcrumb path', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
    });

    it('should render chevron separators between breadcrumb items', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      // ChevronRight SVGs should be present
      const container = screen.getByRole('button', { name: /root/i }).parentElement;
      const chevrons = container?.querySelectorAll('.lucide-chevron-right');
      expect(chevrons?.length).toBeGreaterThan(0);
    });

    it('should render deep folder hierarchy', () => {
      renderWithContext([mockFolder1, mockFolder2, mockFolder3], 'folder-3');

      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('should render with overflow-x-auto for long paths', () => {
      const { container } = renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const breadcrumbContainer = container.querySelector('.overflow-x-auto');
      expect(breadcrumbContainer).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to root when root button is clicked', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const rootButton = screen.getByRole('button', { name: /root/i });
      fireEvent.click(rootButton);

      // After clicking root, path should be empty
      expect(screen.queryByText('Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('Photos')).not.toBeInTheDocument();
    });

    it('should navigate to intermediate folder when clicked', () => {
      renderWithContext([mockFolder1, mockFolder2, mockFolder3], 'folder-3');

      const documentsButton = screen.getByRole('button', { name: 'Documents' });
      fireEvent.click(documentsButton);

      // Should still see Documents button (now as last item)
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    it('should update path when navigating to intermediate folder', () => {
      renderWithContext([mockFolder1, mockFolder2, mockFolder3], 'folder-3');

      const photosButton = screen.getByRole('button', { name: 'Photos' });
      fireEvent.click(photosButton);

      // Path should be truncated to [folder1, folder2]
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
    });

    it('should not allow navigation when clicking last folder in path', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const photosButton = screen.getByRole('button', { name: 'Photos' });

      // Last item should not have drag/drop handlers
      expect(photosButton).toBeInTheDocument();
    });
  });

  describe('Drag and Drop to Root', () => {
    it('should handle file drop on root button', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      // Simulate drag over
      fireEvent.dragOver(rootButton, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      // Simulate drop
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-123';
            if (type === 'text/x-file-name') return 'test.txt';
            return '';
          },
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith('file-123', 'test.txt', null, testUser);
      });
    });

    it('should call onFileMoved when file drop succeeds on root', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-123';
            if (type === 'text/x-file-name') return 'test.txt';
            return '';
          },
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockOnFileMoved).toHaveBeenCalled();
      });
    });

    it('should not call onFileMoved when file drop fails on root', async () => {
      mockMoveFile.mockResolvedValue(false);
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-123';
            if (type === 'text/x-file-name') return 'test.txt';
            return '';
          },
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalled();
      });

      expect(mockOnFileMoved).not.toHaveBeenCalled();
    });

    it('should not move file when fileId is missing on root drop', async () => {
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-name') return 'test.txt';
            return '';
          },
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should not move file when fileName is missing on root drop', async () => {
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-123';
            return '';
          },
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should show visual feedback during drag over root', () => {
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      fireEvent.dragOver(rootButton, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      // Should have ring styles when dragged over
      expect(rootButton).toHaveClass('ring-2');
    });

    it('should remove visual feedback on drag leave from root', () => {
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      fireEvent.dragOver(rootButton, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      expect(rootButton).toHaveClass('ring-2');

      fireEvent.dragLeave(rootButton);

      expect(rootButton).not.toHaveClass('ring-2');
    });
  });

  describe('Drag and Drop to Folder', () => {
    it('should handle file drop on intermediate folder', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const documentsButton = screen.getByRole('button', { name: 'Documents' });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-456';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(documentsButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith('file-456', 'document.pdf', 'folder-1', testUser);
      });
    });

    it('should not allow drop on last folder in path', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const photosButton = screen.getByRole('button', { name: 'Photos' });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'photo.jpg';
            return '';
          },
        },
      });

      fireEvent(photosButton, dropEvent);

      // Should not call moveFile for last item
      expect(mockMoveFile).not.toHaveBeenCalled();
    });

    it('should show visual feedback on drag over folder', () => {
      renderWithContext([mockFolder1, mockFolder2, mockFolder3], 'folder-3');

      const documentsButton = screen.getByRole('button', { name: 'Documents' });

      fireEvent.dragOver(documentsButton, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      expect(documentsButton).toHaveClass('ring-2');
    });

    it('should not show visual feedback on drag over last folder', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const photosButton = screen.getByRole('button', { name: 'Photos' });

      // Last item should not have drag handlers
      expect(photosButton).toBeInTheDocument();
    });

    it('should call onFileMoved when drop succeeds on folder', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const documentsButton = screen.getByRole('button', { name: 'Documents' });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-999';
            if (type === 'text/x-file-name') return 'file.txt';
            return '';
          },
        },
      });

      fireEvent(documentsButton, dropEvent);

      await waitFor(() => {
        expect(mockOnFileMoved).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty folder path', () => {
      renderWithContext([], null);

      expect(screen.getByRole('button', { name: /root/i })).toBeInTheDocument();
      expect(screen.queryByText('Documents')).not.toBeInTheDocument();
    });

    it('should handle single folder with special characters in name', () => {
      const specialFolder: FolderMeta = {
        id: 'folder-special',
        name: 'My Files & Documents (2024)',
        parentId: null,
        userEmail: testUser,
        createdDate: new Date(),
      };

      renderWithContext([specialFolder], 'folder-special');

      expect(screen.getByText('My Files & Documents (2024)')).toBeInTheDocument();
    });

    it('should handle very long folder names', () => {
      const longNameFolder: FolderMeta = {
        id: 'folder-long',
        name: 'This is a very long folder name that should be truncated or handled appropriately',
        parentId: null,
        userEmail: testUser,
        createdDate: new Date(),
      };

      renderWithContext([longNameFolder], 'folder-long');

      expect(screen.getByText(longNameFolder.name)).toBeInTheDocument();
    });

    it('should handle drop with empty dataTransfer', async () => {
      renderWithContext([mockFolder1], 'folder-1');

      const rootButton = screen.getByRole('button', { name: /root/i });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: jest.fn().mockReturnValue(''),
        },
      });

      fireEvent(rootButton, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should handle multiple rapid drag events', () => {
      renderWithContext([mockFolder1, mockFolder2], 'folder-2');

      const rootButton = screen.getByRole('button', { name: /root/i });

      fireEvent.dragOver(rootButton);
      fireEvent.dragLeave(rootButton);
      fireEvent.dragOver(rootButton);
      fireEvent.dragLeave(rootButton);
      fireEvent.dragOver(rootButton);

      expect(rootButton).toBeInTheDocument();
    });
  });
});
