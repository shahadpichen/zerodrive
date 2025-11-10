/**
 * Unit Tests for DexieDB
 * Tests Google Drive metadata sync functionality
 *
 * Note: These tests focus on Google Drive sync and encryption logic
 * rather than Dexie CRUD operations which are library-specific.
 */

// Mock Dexie before any imports
jest.mock('dexie', () => {
  const mockTable = {
    add: jest.fn().mockResolvedValue(1),
    where: jest.fn().mockReturnValue({
      equals: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
        first: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(0),
      }),
    }),
    delete: jest.fn().mockResolvedValue(1),
    clear: jest.fn().mockResolvedValue(undefined),
    toArray: jest.fn().mockResolvedValue([]),
  };

  class MockDexie {
    files = mockTable;
    version() {
      return {
        stores: jest.fn().mockReturnThis(),
      };
    }
    table(tableName: string) {
      return this.files;
    }
    static delete = jest.fn().mockResolvedValue(undefined);
  }

  return {
    __esModule: true,
    default: MockDexie,
  };
});

import { gapi } from 'gapi-script';
import { toast } from 'sonner';
import {
  sendToGoogleDrive,
  fetchAndStoreFileMetadata,
  FileMeta,
} from '../../utils/dexieDB';

// Mock modules
jest.mock('../../utils/gapiInit');
jest.mock('../../utils/metadataEncryption');
jest.mock('sonner');
jest.mock('../../utils/logger');
jest.mock('gapi-script', () => ({
  gapi: {
    load: jest.fn(),
    client: {
      init: jest.fn(),
      setToken: jest.fn(),
      request: jest.fn(),
    },
  },
  gapiComplete: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockGetGoogleAccessToken = jest.fn();
jest.mock('../../utils/gapiInit', () => ({
  getGoogleAccessToken: (...args: any[]) => mockGetGoogleAccessToken(...args),
  initializeGapi: jest.fn(),
  refreshGapiToken: jest.fn(),
}));

const mockEncryptMetadata = jest.fn();
const mockDecryptMetadata = jest.fn();
jest.mock('../../utils/metadataEncryption', () => ({
  encryptMetadata: (...args: any[]) => mockEncryptMetadata(...args),
  decryptMetadata: (...args: any[]) => mockDecryptMetadata(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(() => 'toast-id'),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DexieDB - Google Drive Sync', () => {
  const testUser = 'test@example.com';
  const testFile: FileMeta = {
    id: 'file-123',
    name: 'test.txt',
    mimeType: 'text/plain',
    userEmail: testUser,
    uploadedDate: new Date('2024-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendToGoogleDrive', () => {
    beforeEach(() => {
      mockGetGoogleAccessToken.mockResolvedValue('mock-token');
      mockEncryptMetadata.mockResolvedValue(new Blob(['encrypted-data']));
      (global.fetch as jest.Mock).mockClear();
    });

    it('should create new db-list.json when none exists', async () => {
      const files = [testFile];

      // Mock search response: no existing file
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock upload response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'new-file-id' }),
      });

      await sendToGoogleDrive(files);

      expect(mockEncryptMetadata).toHaveBeenCalledWith({ files });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify POST request for creating new file
      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[0]).toContain('uploadType=multipart');
      expect(uploadCall[1].method).toBe('POST');
    });

    it('should update existing db-list.json', async () => {
      const files = [testFile];

      // Mock search response: existing file found
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'existing-file-id' }] }),
      });

      // Mock update response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'existing-file-id' }),
      });

      await sendToGoogleDrive(files);

      // Verify PATCH request for updating existing file
      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[0]).toContain('existing-file-id');
      expect(uploadCall[1].method).toBe('PATCH');
    });

    it('should throw error when no access token available', async () => {
      mockGetGoogleAccessToken.mockResolvedValue(null);

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow(
        'User not authenticated for Google Drive update.'
      );
    });

    it('should throw error when search request fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should throw error when upload fails', async () => {
      // Mock successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock failed upload
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error details',
      });

      await expect(sendToGoogleDrive([testFile])).rejects.toThrow();
    });

    it('should show success toast on successful sync', async () => {
      // Mock successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // Mock successful upload
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'file-id' }),
      });

      await sendToGoogleDrive([testFile]);

      expect(toast.success).toHaveBeenCalledWith(
        'Metadata successfully synchronized.',
        expect.any(Object)
      );
    });
  });

  describe('fetchAndStoreFileMetadata', () => {
    beforeEach(() => {
      mockGetGoogleAccessToken.mockResolvedValue('mock-token');
      mockDecryptMetadata.mockResolvedValue({
        files: [testFile],
      });
      (global.fetch as jest.Mock).mockClear();
    });

    it('should fetch and decrypt metadata from Google Drive', async () => {
      const { gapi } = require('gapi-script');

      // Mock gapi response
      gapi.client.request = jest.fn().mockResolvedValue({
        result: {
          files: [{ id: 'db-list-id', name: 'db-list.json' }],
        },
      });

      // Mock fetch response for downloading file
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['encrypted-metadata']),
      });

      await fetchAndStoreFileMetadata();

      // Verify decryption was called
      expect(mockDecryptMetadata).toHaveBeenCalled();
      // Verify gapi was called to fetch the file list
      expect(gapi.client.request).toHaveBeenCalled();
    });

    it('should handle case when no db-list.json exists', async () => {
      const { gapi } = require('gapi-script');

      gapi.client.request = jest.fn().mockResolvedValue({
        result: { files: [] },
      });

      await fetchAndStoreFileMetadata();

      // Should not throw error
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should show error toast when decryption fails', async () => {
      const { gapi } = require('gapi-script');

      gapi.client.request = jest.fn().mockResolvedValue({
        result: {
          files: [{ id: 'db-list-id' }],
        },
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['encrypted']),
      });

      mockDecryptMetadata.mockRejectedValue(new Error('Decryption failed'));

      await fetchAndStoreFileMetadata();

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decrypt metadata')
      );
    });
  });
});
