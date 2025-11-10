/**
 * Unit Tests for File Operations
 * Tests file upload, download, and delete operations with Google Drive sync
 */

import {
  uploadAndSyncFile,
  deleteAndSyncFile,
  deleteAllAndSyncFiles,
} from '../../utils/fileOperations';
import { FileMeta } from '../../utils/dexieDB';
import { toast } from 'sonner';

// Mock all dependencies
jest.mock('../../utils/dexieDB');
jest.mock('../../utils/encryptFile');
jest.mock('../../utils/cryptoUtils');
jest.mock('../../utils/gapiInit');
jest.mock('../../utils/logger');
jest.mock('../../utils/analyticsTracker');
jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(() => 'toast-id'),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

global.fetch = jest.fn();

const mockAddFile = jest.fn();
const mockGetAllFilesForUser = jest.fn();
const mockDeleteFileFromDB = jest.fn();
const mockSendToGoogleDrive = jest.fn();
const mockClearUserFilesFromDB = jest.fn();

jest.mock('../../utils/dexieDB', () => ({
  addFile: (...args: any[]) => mockAddFile(...args),
  getAllFilesForUser: (...args: any[]) => mockGetAllFilesForUser(...args),
  deleteFileFromDB: (...args: any[]) => mockDeleteFileFromDB(...args),
  sendToGoogleDrive: (...args: any[]) => mockSendToGoogleDrive(...args),
  clearUserFilesFromDB: (...args: any[]) => mockClearUserFilesFromDB(...args),
}));

const mockEncryptFile = jest.fn();
jest.mock('../../utils/encryptFile', () => ({
  encryptFile: (...args: any[]) => mockEncryptFile(...args),
}));

const mockGetStoredKey = jest.fn();
jest.mock('../../utils/cryptoUtils', () => ({
  getStoredKey: (...args: any[]) => mockGetStoredKey(...args),
}));

const mockGetGoogleAccessToken = jest.fn();
jest.mock('../../utils/gapiInit', () => ({
  getGoogleAccessToken: (...args: any[]) => mockGetGoogleAccessToken(...args),
}));

const mockTrackFileAddedToDrive = jest.fn();
jest.mock('../../utils/analyticsTracker', () => ({
  trackFileAddedToDrive: (...args: any[]) => mockTrackFileAddedToDrive(...args),
}));

describe('FileOperations', () => {
  const testUser = 'test@example.com';
  const mockEncryptedBlob = new Blob(['encrypted-data']);
  const mockToken = 'mock-google-token';
  const mockKey = { k: 'mock-key', kty: 'oct' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoredKey.mockResolvedValue(mockKey);
    mockGetGoogleAccessToken.mockResolvedValue(mockToken);
    mockEncryptFile.mockResolvedValue(mockEncryptedBlob);
    (global.fetch as jest.Mock).mockClear();
  });

  describe('uploadAndSyncFile', () => {
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    it('should upload file successfully', async () => {
      // Mock successful Drive upload
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'drive-file-123' }),
      });

      mockGetAllFilesForUser.mockResolvedValue([]);
      mockSendToGoogleDrive.mockResolvedValue(undefined);

      const result = await uploadAndSyncFile(testFile, testUser);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('drive-file-123');
      expect(result?.name).toBe('test.txt');
      expect(result?.mimeType).toBe('text/plain');
      expect(result?.userEmail).toBe(testUser);

      expect(mockEncryptFile).toHaveBeenCalledWith(testFile);
      expect(mockAddFile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'drive-file-123',
          name: 'test.txt',
          userEmail: testUser,
        })
      );
      expect(mockSendToGoogleDrive).toHaveBeenCalled();
      expect(mockTrackFileAddedToDrive).toHaveBeenCalledWith('upload');
      expect(toast.success).toHaveBeenCalled();
    });

    it('should return null when encryption key is missing', async () => {
      mockGetStoredKey.mockResolvedValue(null);

      const result = await uploadAndSyncFile(testFile, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload'),
        expect.any(Object)
      );
      expect(mockEncryptFile).not.toHaveBeenCalled();
    });

    it('should return null when user is not authenticated', async () => {
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await uploadAndSyncFile(testFile, testUser);

      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should return null when Drive upload fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Insufficient storage' },
        }),
        statusText: 'Forbidden',
      });

      const result = await uploadAndSyncFile(testFile, testUser);

      expect(result).toBeNull();
      expect(mockAddFile).not.toHaveBeenCalled();
      expect(mockSendToGoogleDrive).not.toHaveBeenCalled();
    });

    it('should return null when Drive returns no file ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'test.txt' }), // Missing 'id'
      });

      const result = await uploadAndSyncFile(testFile, testUser);

      expect(result).toBeNull();
    });

    it('should continue even if metadata sync fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'drive-file-123' }),
      });

      mockGetAllFilesForUser.mockResolvedValue([]);
      mockSendToGoogleDrive.mockRejectedValue(new Error('Sync failed'));

      const result = await uploadAndSyncFile(testFile, testUser);

      // Should return null because sendToGoogleDrive throws
      expect(result).toBeNull();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should upload file with correct FormData', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      mockGetAllFilesForUser.mockResolvedValue([]);

      await uploadAndSyncFile(testFile, testUser);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('googleapis.com/upload/drive/v3/files');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(fetchCall[1].body).toBeInstanceOf(FormData);
    });
  });

  describe('deleteAndSyncFile', () => {
    const fileId = 'file-123';
    const fileName = 'test.txt';

    it('should delete file successfully from Drive and local DB', async () => {
      // Mock successful Drive delete
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      mockDeleteFileFromDB.mockResolvedValue(1);
      mockGetAllFilesForUser.mockResolvedValue([]);
      mockSendToGoogleDrive.mockResolvedValue(undefined);

      const result = await deleteAndSyncFile(fileId, fileName, testUser);

      expect(result).toBe(true);
      expect(mockDeleteFileFromDB).toHaveBeenCalledWith(fileId);
      expect(mockSendToGoogleDrive).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
    });

    it('should succeed even if file is not found on Drive (404)', async () => {
      // Mock 404 from Drive
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      mockDeleteFileFromDB.mockResolvedValue(1);
      mockGetAllFilesForUser.mockResolvedValue([]);

      const result = await deleteAndSyncFile(fileId, fileName, testUser);

      expect(result).toBe(true);
      expect(mockDeleteFileFromDB).toHaveBeenCalled();
    });

    it('should return false when user is not authenticated', async () => {
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await deleteAndSyncFile(fileId, fileName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should show warning when Drive delete fails but continue locally', async () => {
      // Mock Drive delete failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      mockDeleteFileFromDB.mockResolvedValue(1);
      mockGetAllFilesForUser.mockResolvedValue([]);

      const result = await deleteAndSyncFile(fileId, fileName, testUser);

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalled();
      expect(mockDeleteFileFromDB).toHaveBeenCalled();
    });

    it('should return false if metadata sync fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      mockDeleteFileFromDB.mockResolvedValue(1);
      mockGetAllFilesForUser.mockResolvedValue([]);
      mockSendToGoogleDrive.mockRejectedValue(new Error('Sync failed'));

      const result = await deleteAndSyncFile(fileId, fileName, testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('deleteAllAndSyncFiles', () => {
    const testFiles: FileMeta[] = [
      {
        id: 'file-1',
        name: 'test1.txt',
        mimeType: 'text/plain',
        userEmail: testUser,
        uploadedDate: new Date(),
      },
      {
        id: 'file-2',
        name: 'test2.txt',
        mimeType: 'text/plain',
        userEmail: testUser,
        uploadedDate: new Date(),
      },
    ];

    it('should delete all files successfully', async () => {
      mockGetAllFilesForUser.mockResolvedValue(testFiles);

      // Mock successful Drive deletes
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 204,
      });

      mockClearUserFilesFromDB.mockResolvedValue(2);
      mockSendToGoogleDrive.mockResolvedValue(undefined);

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2); // 2 files deleted
      expect(mockClearUserFilesFromDB).toHaveBeenCalledWith(testUser);
      expect(mockSendToGoogleDrive).toHaveBeenCalledWith([]); // Empty array
      expect(toast.success).toHaveBeenCalled();
    });

    it('should return true when user has no files', async () => {
      mockGetAllFilesForUser.mockResolvedValue([]);

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(true);
      expect(toast.info).toHaveBeenCalledWith(
        'No files found to delete.',
        expect.any(Object)
      );
    });

    it('should return false when user is not authenticated', async () => {
      mockGetAllFilesForUser.mockResolvedValue(testFiles);
      mockGetGoogleAccessToken.mockResolvedValue(null);

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should continue deletion even if some Drive deletes fail', async () => {
      mockGetAllFilesForUser.mockResolvedValue(testFiles);

      // Mock first delete succeeds, second fails
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' });

      mockClearUserFilesFromDB.mockResolvedValue(2);

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(true);
      expect(toast.warning).toHaveBeenCalled();
      expect(mockClearUserFilesFromDB).toHaveBeenCalled();
    });

    it('should return false if local DB clear fails', async () => {
      mockGetAllFilesForUser.mockResolvedValue(testFiles);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      mockClearUserFilesFromDB.mockRejectedValue(new Error('DB error'));

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle 404 errors gracefully', async () => {
      mockGetAllFilesForUser.mockResolvedValue(testFiles);

      // Mock all deletes return 404 (already deleted)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      mockClearUserFilesFromDB.mockResolvedValue(2);

      const result = await deleteAllAndSyncFiles(testUser);

      expect(result).toBe(true);
      expect(mockClearUserFilesFromDB).toHaveBeenCalled();
    });
  });
});
