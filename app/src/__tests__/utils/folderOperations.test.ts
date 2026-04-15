/**
 * Unit Tests for Folder Operations
 * Tests folder creation, deletion, and file moving with Google Drive sync
 */

import {
  createFolder,
  deleteFolder,
  moveFile,
} from '../../utils/folderOperations';
import { toast } from 'sonner';

// Mock all dependencies
jest.mock('../../utils/dexieDB');
jest.mock('../../utils/gapiInit');
jest.mock('../../utils/logger');
jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(() => 'toast-id'),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

global.fetch = jest.fn();

const mockAddFolder = jest.fn();
const mockGetFoldersForUser = jest.fn();
const mockGetFilesInFolder = jest.fn();
const mockDeleteFolderFromDB = jest.fn();
const mockMoveFileToFolder = jest.fn();
const mockGetAllFilesForUser = jest.fn();
const mockSendToGoogleDrive = jest.fn();
const mockGetFileByIdForUser = jest.fn();

jest.mock('../../utils/dexieDB', () => ({
  addFolder: (...args: any[]) => mockAddFolder(...args),
  getFoldersForUser: (...args: any[]) => mockGetFoldersForUser(...args),
  getFilesInFolder: (...args: any[]) => mockGetFilesInFolder(...args),
  deleteFolder: (...args: any[]) => mockDeleteFolderFromDB(...args),
  moveFileToFolder: (...args: any[]) => mockMoveFileToFolder(...args),
  getAllFilesForUser: (...args: any[]) => mockGetAllFilesForUser(...args),
  sendToGoogleDrive: (...args: any[]) => mockSendToGoogleDrive(...args),
  getFileByIdForUser: (...args: any[]) => mockGetFileByIdForUser(...args),
}));

const mockGetGoogleAccessToken = jest.fn();
jest.mock('../../utils/gapiInit', () => ({
  getGoogleAccessToken: (...args: any[]) => mockGetGoogleAccessToken(...args),
}));

describe('FolderOperations', () => {
  const testUser = 'test@example.com';
  const mockToken = 'mock-google-token';
  const mockFolderId = 'folder-123';
  const mockFolderName = 'Test Folder';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGoogleAccessToken.mockResolvedValue(mockToken);
    mockGetAllFilesForUser.mockResolvedValue([]);
    mockGetFoldersForUser.mockResolvedValue([]);
    mockSendToGoogleDrive.mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('createFolder', () => {
    it('should create folder successfully at root level', async () => {
      // Mock successful Drive API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: mockFolderName }),
      });

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockFolderId);
      expect(result?.name).toBe(mockFolderName);
      expect(result?.parentId).toBeNull();
      expect(result?.userEmail).toBe(testUser);
      expect(result?.createdDate).toBeInstanceOf(Date);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files?fields=id,name',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(mockAddFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockFolderId,
          name: mockFolderName,
          parentId: null,
          userEmail: testUser,
        })
      );

      expect(mockSendToGoogleDrive).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        `Folder "${mockFolderName}" created`,
        expect.any(Object)
      );
    });

    it('should create folder successfully with parent folder', async () => {
      const parentFolderId = 'parent-folder-123';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: mockFolderName }),
      });

      const result = await createFolder(mockFolderName, parentFolderId, testUser);

      expect(result).not.toBeNull();
      expect(result?.parentId).toBe(parentFolderId);

      // Verify request includes parent folder
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.parents).toEqual([parentFolderId]);
    });

    it('should return null when user is not authenticated', async () => {
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create folder',
        expect.objectContaining({
          description: 'User not authenticated.',
        })
      );
      expect(mockAddFolder).not.toHaveBeenCalled();
    });

    it('should return null when Drive API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Insufficient permissions' },
        }),
      });

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalled();
      expect(mockAddFolder).not.toHaveBeenCalled();
    });

    it('should return null when Drive API returns no ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: mockFolderName }), // Missing id
      });

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).toBeNull();
    });

    it('should handle folder creation with special characters in name', async () => {
      const specialName = 'Test Folder @#$% 2024';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: specialName }),
      });

      const result = await createFolder(specialName, null, testUser);

      expect(result?.name).toBe(specialName);
      expect(toast.success).toHaveBeenCalled();
    });

    it('should return null when metadata sync fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: mockFolderName }),
      });

      mockSendToGoogleDrive.mockRejectedValue(new Error('Sync failed'));

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await createFolder(mockFolderName, null, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle empty folder name', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: '' }),
      });

      const result = await createFolder('', null, testUser);

      expect(result?.name).toBe('');
    });
  });

  describe('deleteFolder', () => {
    it('should delete empty folder successfully', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(true);
      expect(mockDeleteFolderFromDB).toHaveBeenCalledWith(mockFolderId);
      expect(mockSendToGoogleDrive).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        `Folder "${mockFolderName}" deleted`,
        expect.any(Object)
      );
    });

    it('should return false when folder has files and force is false', async () => {
      const filesInFolder = [
        { id: 'file-1', name: 'test1.txt', userEmail: testUser },
        { id: 'file-2', name: 'test2.txt', userEmail: testUser },
      ];
      mockGetFilesInFolder.mockResolvedValue(filesInFolder);

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser, false);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Folder is not empty',
        expect.objectContaining({
          description: 'Move or delete 2 file(s) first',
        })
      );
      expect(mockDeleteFolderFromDB).not.toHaveBeenCalled();
    });

    it('should move files to root and delete folder when force is true', async () => {
      const filesInFolder = [
        { id: 'file-1', name: 'test1.txt', userEmail: testUser },
        { id: 'file-2', name: 'test2.txt', userEmail: testUser },
      ];
      mockGetFilesInFolder.mockResolvedValue(filesInFolder);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser, true);

      expect(result).toBe(true);
      expect(mockMoveFileToFolder).toHaveBeenCalledTimes(2);
      expect(mockMoveFileToFolder).toHaveBeenCalledWith('file-1', null);
      expect(mockMoveFileToFolder).toHaveBeenCalledWith('file-2', null);
      expect(mockDeleteFolderFromDB).toHaveBeenCalled();
    });

    it('should return false when user is not authenticated', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should return false when Drive API delete fails', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
      expect(mockDeleteFolderFromDB).not.toHaveBeenCalled();
    });

    it('should handle 404 error and delete from local DB', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(false);
    });

    it('should return false when metadata sync fails', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      mockSendToGoogleDrive.mockRejectedValue(new Error('Sync failed'));

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockGetFilesInFolder.mockResolvedValue([]);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle folder with single file', async () => {
      mockGetFilesInFolder.mockResolvedValue([
        { id: 'file-1', name: 'test.txt', userEmail: testUser },
      ]);

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser, false);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Folder is not empty',
        expect.objectContaining({
          description: 'Move or delete 1 file(s) first',
        })
      );
    });
  });

  describe('moveFile', () => {
    const fileId = 'file-123';
    const fileName = 'test.txt';
    const currentFolderId = 'folder-current';
    const newFolderId = 'folder-new';

    it('should move file to new folder successfully', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(true);

      // Verify Drive API call
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain(fileId);
      expect(fetchCall[0]).toContain(`removeParents=${currentFolderId}`);
      expect(fetchCall[0]).toContain(`addParents=${newFolderId}`);
      expect(fetchCall[1].method).toBe('PATCH');

      expect(mockMoveFileToFolder).toHaveBeenCalledWith(fileId, newFolderId);
      expect(mockSendToGoogleDrive).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        `Moved "${fileName}"`,
        expect.any(Object)
      );
    });

    it('should move file from root to folder', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: null,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(true);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain(`addParents=${newFolderId}`);
      expect(fetchCall[0]).not.toContain('removeParents');
    });

    it('should move file from folder to root', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await moveFile(fileId, fileName, null, testUser);

      expect(result).toBe(true);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain(`removeParents=${currentFolderId}`);
      expect(fetchCall[0]).not.toContain('addParents');

      expect(mockMoveFileToFolder).toHaveBeenCalledWith(fileId, null);
    });

    it('should return false when user is not authenticated', async () => {
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should return false when file is not found', async () => {
      mockGetFileByIdForUser.mockResolvedValue(null);

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to move file',
        expect.objectContaining({
          description: 'File not found',
        })
      );
    });

    it('should return false when Drive API fails', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
      expect(mockMoveFileToFolder).not.toHaveBeenCalled();
    });

    it('should handle file already at root being moved to root', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: null,
        userEmail: testUser,
      });

      const result = await moveFile(fileId, fileName, null, testUser);

      expect(result).toBe(true);
      // Should not make Drive API call when no parents to add/remove
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockMoveFileToFolder).toHaveBeenCalledWith(fileId, null);
    });

    it('should return false when metadata sync fails', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      mockSendToGoogleDrive.mockRejectedValue(new Error('Sync failed'));

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: fileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await moveFile(fileId, fileName, newFolderId, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle files with special characters in name', async () => {
      const specialFileName = 'test @#$% file.txt';

      mockGetFileByIdForUser.mockResolvedValue({
        id: fileId,
        name: specialFileName,
        folderId: currentFolderId,
        userEmail: testUser,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await moveFile(fileId, specialFileName, newFolderId, testUser);

      expect(result).toBe(true);
      expect(toast.success).toHaveBeenCalledWith(
        `Moved "${specialFileName}"`,
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle createFolder with very long folder name', async () => {
      const longName = 'a'.repeat(1000);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: longName }),
      });

      const result = await createFolder(longName, null, testUser);

      expect(result?.name).toBe(longName);
    });

    it('should handle deleteFolder with many files when force is true', async () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        id: `file-${i}`,
        name: `test${i}.txt`,
        userEmail: testUser,
      }));
      mockGetFilesInFolder.mockResolvedValue(manyFiles);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await deleteFolder(mockFolderId, mockFolderName, testUser, true);

      expect(result).toBe(true);
      expect(mockMoveFileToFolder).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent folder operations', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'folder-concurrent', name: 'Test' }),
      });

      const results = await Promise.all([
        createFolder('Folder 1', null, testUser),
        createFolder('Folder 2', null, testUser),
        createFolder('Folder 3', null, testUser),
      ]);

      expect(results.every((r) => r !== null)).toBe(true);
    });

    it('should handle null user email gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockFolderId, name: mockFolderName }),
      });

      const result = await createFolder(mockFolderName, null, '');

      expect(result?.userEmail).toBe('');
    });
  });
});
