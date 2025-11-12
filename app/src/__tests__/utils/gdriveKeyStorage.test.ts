/**
 * Unit Tests for Google Drive Key Storage
 * Tests RSA key backup/restore with error propagation
 */

import {
  uploadEncryptedRsaKeyToDrive,
  downloadEncryptedRsaKeyFromDrive,
} from '../../utils/gdriveKeyStorage';
import { getGoogleAccessToken } from '../../utils/gapiInit';
import { gapi } from 'gapi-script';

// Mock dependencies
jest.mock('../../utils/gapiInit');
jest.mock('gapi-script', () => ({
  gapi: {
    client: {
      load: jest.fn(),
      drive: {
        files: {
          list: jest.fn(),
        },
      },
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock logger to avoid console spam
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('gdriveKeyStorage', () => {
  const mockAccessToken = 'mock-access-token';
  const mockBlob = new Blob(['encrypted-key-data'], { type: 'application/json' });

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('uploadEncryptedRsaKeyToDrive', () => {
    it('should throw error when no access token available', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow(
        'User not authenticated for Google Drive upload'
      );
    });

    it('should throw error on 403 Forbidden response', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      // Mock list response (checking for existing file)
      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: { files: [] },
          }),
        },
      };

      // Mock fetch to return 403
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 403,
            message: 'The granted scopes do not give access to all of the requested spaces',
          },
        }),
      });

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow();
    });

    it('should successfully upload and return file ID', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      // Mock list response (no existing file)
      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: { files: [] },
          }),
        },
      };

      const mockFileId = 'mock-file-id-123';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: mockFileId }),
      });

      const result = await uploadEncryptedRsaKeyToDrive(mockBlob);

      expect(result).toBe(mockFileId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('googleapis.com/upload/drive/v3/files'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });

    it('should update existing file instead of creating new one', async () => {
      const existingFileId = 'existing-file-id';
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      // Mock list response (existing file found)
      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: {
              files: [{ id: existingFileId }],
            },
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: existingFileId }),
      });

      const result = await uploadEncryptedRsaKeyToDrive(mockBlob);

      expect(result).toBe(existingFileId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`files/${existingFileId}`),
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should propagate error with details when upload fails', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: { files: [] },
          }),
        },
      };

      const errorMessage = 'Network error';
      (global.fetch as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow(errorMessage);
    });
  });

  describe('downloadEncryptedRsaKeyFromDrive', () => {
    it('should throw error when no access token available', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        'User not authenticated for Google Drive download'
      );
    });

    it('should throw error when file not found in appDataFolder or root Drive', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      // Mock list response (no files found in either location)
      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: { files: [] },
          }),
        },
      };

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        'not found in appDataFolder or root Google Drive'
      );
    });

    it('should successfully download and return Blob', async () => {
      const mockFileId = 'mock-file-id';
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      // Mock list response (file found)
      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: {
              files: [{ id: mockFileId, name: 'zerodrive_rsa_key_backup.json' }],
            },
          }),
        },
      };

      const mockDownloadedBlob = new Blob(['downloaded-key'], { type: 'application/json' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => mockDownloadedBlob,
      });

      const result = await downloadEncryptedRsaKeyFromDrive();

      expect(result).toBe(mockDownloadedBlob);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`files/${mockFileId}?alt=media`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      );
    });

    it('should throw error when download request fails', async () => {
      const mockFileId = 'mock-file-id';
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: {
              files: [{ id: mockFileId, name: 'zerodrive_rsa_key_backup.json' }],
            },
          }),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow(
        'Failed to download key file from appDataFolder (hidden)'
      );
    });

    it('should propagate network errors', async () => {
      const mockFileId = 'mock-file-id';
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (gapi.client.load as jest.Mock).mockResolvedValue(undefined);

      (gapi.client as any).drive = {
        files: {
          list: jest.fn().mockResolvedValue({
            result: {
              files: [{ id: mockFileId }],
            },
          }),
        },
      };

      const networkError = new Error('Network connection failed');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow('Network connection failed');
    });
  });

  describe('Error Propagation', () => {
    it('uploadEncryptedRsaKeyToDrive should never return null', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      // Should throw, not return null
      await expect(uploadEncryptedRsaKeyToDrive(mockBlob)).rejects.toThrow();
    });

    it('downloadEncryptedRsaKeyFromDrive should never return null', async () => {
      (getGoogleAccessToken as jest.Mock).mockResolvedValue(null);

      // Should throw, not return null
      await expect(downloadEncryptedRsaKeyFromDrive()).rejects.toThrow();
    });
  });
});
