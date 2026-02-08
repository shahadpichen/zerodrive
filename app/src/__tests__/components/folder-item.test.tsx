/**
 * Unit Tests for FolderItem Component
 * Tests folder card rendering, navigation, deletion, and drag-and-drop
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderItem } from '../../components/storage/folder-item';
import { FolderProvider } from '../../components/storage/folder-context';
import { deleteFolder, moveFile } from '../../utils/folderOperations';
import type { FolderMeta } from '../../utils/dexieDB';

// Mock dependencies
jest.mock('../../utils/folderOperations');
jest.mock('../../utils/logger');
jest.mock('sonner');

const mockDeleteFolder = deleteFolder as jest.MockedFunction<typeof deleteFolder>;
const mockMoveFile = moveFile as jest.MockedFunction<typeof moveFile>;

describe('FolderItem Component', () => {
  const testUser = 'test@example.com';
  const mockOnDeleted = jest.fn();
  const mockOnFileMoved = jest.fn();

  const mockFolder: FolderMeta = {
    id: 'folder-123',
    name: 'My Documents',
    parentId: null,
    userEmail: testUser,
    createdDate: new Date('2024-01-15'),
  };

  const mockNestedFolder: FolderMeta = {
    id: 'folder-456',
    name: 'Photos',
    parentId: 'folder-123',
    userEmail: testUser,
    createdDate: new Date('2024-01-20'),
  };

  const renderWithContext = (folder: FolderMeta, onDeleted = mockOnDeleted, onFileMoved = mockOnFileMoved) => {
    return render(
      <FolderProvider>
        <FolderItem
          folder={folder}
          userEmail={testUser}
          onDeleted={onDeleted}
          onFileMoved={onFileMoved}
        />
      </FolderProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render folder name', () => {
      renderWithContext(mockFolder);

      expect(screen.getByText('My Documents')).toBeInTheDocument();
    });

    it('should render folder icon', () => {
      renderWithContext(mockFolder);

      const folderIcon = screen.getByAltText('');
      expect(folderIcon).toBeInTheDocument();
      expect(folderIcon).toHaveAttribute('src', '/folder.png');
    });

    it('should render folder with title attribute', () => {
      renderWithContext(mockFolder);

      const folderContainer = screen.getByText('My Documents').closest('div');
      expect(folderContainer).toHaveAttribute('title', 'My Documents');
    });

    it('should render folder with special characters in name', () => {
      const specialFolder: FolderMeta = {
        ...mockFolder,
        name: 'Files & Folders (2024)',
      };

      renderWithContext(specialFolder);

      expect(screen.getByText('Files & Folders (2024)')).toBeInTheDocument();
    });

    it('should render folder with very long name', () => {
      const longNameFolder: FolderMeta = {
        ...mockFolder,
        name: 'This is a very long folder name that should be truncated in the UI with ellipsis',
      };

      renderWithContext(longNameFolder);

      const folderText = screen.getByText(longNameFolder.name);
      expect(folderText).toBeInTheDocument();
      expect(folderText).toHaveClass('truncate');
    });

    it('should render delete menu button', () => {
      renderWithContext(mockFolder);

      // Menu trigger button (MoreVertical icon)
      const menuButtons = screen.getAllByRole('button');
      expect(menuButtons.length).toBeGreaterThan(0);
    });

    it('should have hover effect classes', () => {
      const { container } = renderWithContext(mockFolder);

      const folderDiv = container.querySelector('.group');
      expect(folderDiv).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to folder when clicked', () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');
      fireEvent.click(folderElement!);

      // Context should be updated (tested in folder-context.test.tsx)
      expect(folderElement).toBeInTheDocument();
    });

    it('should update path when navigating to nested folder', () => {
      renderWithContext(mockNestedFolder);

      const folderElement = screen.getByText('Photos').closest('div');
      fireEvent.click(folderElement!);

      expect(folderElement).toBeInTheDocument();
    });

    it('should navigate when clicking folder icon', () => {
      renderWithContext(mockFolder);

      const folderIcon = screen.getByAltText('');
      const folderContainer = folderIcon.closest('div');

      fireEvent.click(folderContainer!);

      expect(folderContainer).toBeInTheDocument();
    });

    it('should navigate when clicking folder name', () => {
      renderWithContext(mockFolder);

      const folderName = screen.getByText('My Documents');
      const folderContainer = folderName.closest('div');

      fireEvent.click(folderContainer!);

      expect(folderContainer).toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('should open delete confirmation dialog when delete is clicked', async () => {
      renderWithContext(mockFolder);

      // Click menu trigger
      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      // Wait for menu to open and click delete
      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(`Delete "${mockFolder.name}"?`)).toBeInTheDocument();
      });
    });

    it('should show confirmation message in delete dialog', async () => {
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        expect(screen.getByText(/any files inside will be moved to the root folder/i)).toBeInTheDocument();
      });
    });

    it('should call deleteFolder when confirm is clicked', async () => {
      mockDeleteFolder.mockResolvedValue(true);
      renderWithContext(mockFolder);

      // Open menu
      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      // Click delete
      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      // Confirm deletion
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockDeleteFolder).toHaveBeenCalledWith('folder-123', 'My Documents', testUser, true);
      });
    });

    it('should call onDeleted callback when deletion succeeds', async () => {
      mockDeleteFolder.mockResolvedValue(true);
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockOnDeleted).toHaveBeenCalled();
      });
    });

    it('should not call onDeleted when deletion fails', async () => {
      mockDeleteFolder.mockResolvedValue(false);
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockDeleteFolder).toHaveBeenCalled();
      });

      expect(mockOnDeleted).not.toHaveBeenCalled();
    });

    it('should show deleting state while delete is in progress', async () => {
      mockDeleteFolder.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)));
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      // Should show "Deleting..." text
      await waitFor(() => {
        expect(screen.getByText(/deleting/i)).toBeInTheDocument();
      });
    });

    it('should close dialog when cancel is clicked', async () => {
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        expect(screen.getByText(`Delete "${mockFolder.name}"?`)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(`Delete "${mockFolder.name}"?`)).not.toBeInTheDocument();
      });
    });

    it('should not call deleteFolder when cancel is clicked', async () => {
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
      });

      expect(mockDeleteFolder).not.toHaveBeenCalled();
    });

    it('should stop propagation when clicking menu trigger', () => {
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

      fireEvent(menuTrigger, clickEvent);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should stop propagation when clicking delete menu item', async () => {
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        const clickEvent = new MouseEvent('click', { bubbles: true });
        const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

        fireEvent(deleteItem, clickEvent);

        expect(stopPropagationSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle file drop on folder', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith('file-789', 'document.pdf', 'folder-123', testUser);
      });
    });

    it('should call onFileMoved when drop succeeds', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockOnFileMoved).toHaveBeenCalled();
      });
    });

    it('should not call onFileMoved when drop fails', async () => {
      mockMoveFile.mockResolvedValue(false);
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalled();
      });

      expect(mockOnFileMoved).not.toHaveBeenCalled();
    });

    it('should not call onFileMoved when callback is not provided', async () => {
      mockMoveFile.mockResolvedValue(true);
      render(
        <FolderProvider>
          <FolderItem
            folder={mockFolder}
            userEmail={testUser}
            onDeleted={mockOnDeleted}
          />
        </FolderProvider>
      );

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalled();
      });

      // Should not throw error when onFileMoved is undefined
      expect(mockOnFileMoved).not.toHaveBeenCalled();
    });

    it('should not move file when fileId is missing', async () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should not move file when fileName is missing', async () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should show visual feedback during drag over', () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      fireEvent.dragOver(folderElement!, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      expect(folderElement).toHaveClass('ring-2');
      expect(folderElement).toHaveClass('ring-primary');
      expect(folderElement).toHaveClass('scale-105');
    });

    it('should remove visual feedback on drag leave', () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      fireEvent.dragOver(folderElement!, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      expect(folderElement).toHaveClass('ring-2');

      fireEvent.dragLeave(folderElement!);

      expect(folderElement).not.toHaveClass('ring-2');
    });

    it('should remove visual feedback after drop', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      fireEvent.dragOver(folderElement!, {
        dataTransfer: {
          getData: jest.fn(),
        },
      });

      expect(folderElement).toHaveClass('ring-2');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-789';
            if (type === 'text/x-file-name') return 'document.pdf';
            return '';
          },
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(folderElement).not.toHaveClass('ring-2');
      });
    });

    it('should handle multiple files dropped sequentially', async () => {
      mockMoveFile.mockResolvedValue(true);
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      // Drop first file
      const dropEvent1 = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent1, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-1';
            if (type === 'text/x-file-name') return 'file1.txt';
            return '';
          },
        },
      });
      fireEvent(folderElement!, dropEvent1);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith('file-1', 'file1.txt', 'folder-123', testUser);
      });

      // Drop second file
      const dropEvent2 = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent2, 'dataTransfer', {
        value: {
          getData: (type: string) => {
            if (type === 'text/x-file-id') return 'file-2';
            if (type === 'text/x-file-name') return 'file2.txt';
            return '';
          },
        },
      });
      fireEvent(folderElement!, dropEvent2);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith('file-2', 'file2.txt', 'folder-123', testUser);
      });

      expect(mockMoveFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle folder with empty name', () => {
      const emptyNameFolder: FolderMeta = {
        ...mockFolder,
        name: '',
      };

      renderWithContext(emptyNameFolder);

      expect(screen.getByAltText('')).toBeInTheDocument();
    });

    it('should handle folder with null parentId', () => {
      const rootFolder: FolderMeta = {
        ...mockFolder,
        parentId: null,
      };

      renderWithContext(rootFolder);

      expect(screen.getByText('My Documents')).toBeInTheDocument();
    });

    it('should handle folder with parentId', () => {
      renderWithContext(mockNestedFolder);

      expect(screen.getByText('Photos')).toBeInTheDocument();
    });

    it('should handle drop with empty dataTransfer data', async () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          getData: jest.fn().mockReturnValue(''),
        },
      });

      fireEvent(folderElement!, dropEvent);

      await waitFor(() => {
        expect(mockMoveFile).not.toHaveBeenCalled();
      });
    });

    it('should handle rapid drag over and leave events', () => {
      renderWithContext(mockFolder);

      const folderElement = screen.getByText('My Documents').closest('div');

      for (let i = 0; i < 5; i++) {
        fireEvent.dragOver(folderElement!);
        fireEvent.dragLeave(folderElement!);
      }

      expect(folderElement).toBeInTheDocument();
    });

    it('should handle delete when folder operation is in progress', async () => {
      mockDeleteFolder.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 1000)));
      renderWithContext(mockFolder);

      const menuTrigger = screen.getAllByRole('button')[0];
      fireEvent.click(menuTrigger);

      await waitFor(() => {
        const deleteItem = screen.getByText(/delete folder/i);
        fireEvent.click(deleteItem);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      // Try to click confirm again while deleting
      const confirmButton = screen.getByRole('button', { name: /deleting/i });
      fireEvent.click(confirmButton);

      // Should only call deleteFolder once
      await waitFor(() => {
        expect(mockDeleteFolder).toHaveBeenCalledTimes(1);
      });
    });
  });
});
