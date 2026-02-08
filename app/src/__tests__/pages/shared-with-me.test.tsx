/**
 * UI Component Tests for Shared With Me Page
 *
 * Tests shared file loading, downloads, user interactions, and state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SharedWithMePage from '../../pages/shared-with-me';
import '@testing-library/jest-dom';

import { getUserEmail } from '../../utils/authService';
import apiClient from '../../utils/apiClient';
import {
  hashEmail,
  decryptSharedFile,
  arrayBufferToBase64,
  fetchUserPublicKey,
  downloadEncryptedFile,
  deleteFileFromStorage,
} from '../../utils/fileSharing';
import { getStoredKey } from '../../utils/cryptoUtils';
import { getUserKeyPair } from '../../utils/keyStorage';
import { uploadAndSyncFile } from '../../utils/fileOperations';
import { getMnemonic } from '../../utils/mnemonicManager';
import { recoverRsaKeysIfNeeded } from '../../utils/rsaKeyRecovery';
import { toast } from 'sonner';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock authService
jest.mock('../../utils/authService', () => ({
  getUserEmail: jest.fn(),
}));

// Mock apiClient
jest.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: {
    sharedFiles: {
      getForUser: jest.fn(),
      delete: jest.fn(),
    },
    get: jest.fn(),
  },
}));

// Mock fileSharing utilities
jest.mock('../../utils/fileSharing', () => ({
  hashEmail: jest.fn(),
  decryptSharedFile: jest.fn(),
  arrayBufferToBase64: jest.fn(),
  storeUserPublicKey: jest.fn(),
  deleteFileFromStorage: jest.fn(),
  fetchUserPublicKey: jest.fn(),
  downloadEncryptedFile: jest.fn(),
}));

// Mock cryptoUtils
jest.mock('../../utils/cryptoUtils', () => ({
  getStoredKey: jest.fn(),
}));

// Mock keyStorage
jest.mock('../../utils/keyStorage', () => ({
  getUserKeyPair: jest.fn(),
}));

// Mock fileOperations
jest.mock('../../utils/fileOperations', () => ({
  uploadAndSyncFile: jest.fn(),
}));

// Mock mnemonicManager
jest.mock('../../utils/mnemonicManager', () => ({
  getMnemonic: jest.fn(),
}));

// Mock rsaKeyRecovery
jest.mock('../../utils/rsaKeyRecovery', () => ({
  recoverRsaKeysIfNeeded: jest.fn(),
}));

// Mock analyticsTracker
jest.mock('../../utils/analyticsTracker', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvent: {
    SHARED_FILE_ACCESSED: 'shared_file_accessed',
  },
  AnalyticsCategory: {
    SHARING: 'sharing',
  },
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockGetUserEmail = getUserEmail as jest.MockedFunction<typeof getUserEmail>;
const mockHashEmail = hashEmail as jest.MockedFunction<typeof hashEmail>;
const mockDecryptSharedFile = decryptSharedFile as jest.MockedFunction<typeof decryptSharedFile>;
const mockArrayBufferToBase64 = arrayBufferToBase64 as jest.MockedFunction<typeof arrayBufferToBase64>;
const mockFetchUserPublicKey = fetchUserPublicKey as jest.MockedFunction<typeof fetchUserPublicKey>;
const mockDownloadEncryptedFile = downloadEncryptedFile as jest.MockedFunction<typeof downloadEncryptedFile>;
const mockDeleteFileFromStorage = deleteFileFromStorage as jest.MockedFunction<typeof deleteFileFromStorage>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<typeof getStoredKey>;
const mockGetUserKeyPair = getUserKeyPair as jest.MockedFunction<typeof getUserKeyPair>;
const mockUploadAndSyncFile = uploadAndSyncFile as jest.MockedFunction<typeof uploadAndSyncFile>;
const mockGetMnemonic = getMnemonic as jest.MockedFunction<typeof getMnemonic>;
const mockRecoverRsaKeysIfNeeded = recoverRsaKeysIfNeeded as jest.MockedFunction<typeof recoverRsaKeysIfNeeded>;

// Helper to render component with Router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Mock shared file data
const mockSharedFile = {
  id: 'share-123',
  fileId: 'file-456',
  driveFileId: 'drive-789',
  originalFileName: 'test-document.pdf',
  sender: 'sender@example.com',
  createdAt: '2024-01-15T10:30:00.000Z',
  encryptedFileKey: 'encrypted-key-base64',
  fileSize: 102400,
  mimeType: 'application/pdf',
  encrypted_file_blob_id: 'blob-123',
};

describe('SharedWithMePage', () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeAll(() => {
    // Suppress React act() warnings and expected async errors in tests
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation((message) => {
      if (
        typeof message === 'string' &&
        (message.includes('act(...)') || message.includes('not wrapped in act'))
      ) {
        return;
      }
    });

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterAll(() => {
    consoleErrorMock.mockRestore();
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();

    // Default mocks for auth
    mockGetUserEmail.mockResolvedValue('test@example.com');
    mockHashEmail.mockResolvedValue('hashed-email');

    // Default mocks for key recovery
    mockRecoverRsaKeysIfNeeded.mockResolvedValue({
      success: true,
      keysExisted: true,
      recovered: false,
    });

    // Default mocks for empty file list
    (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
      success: true,
      files: [],
    });

    // Reset all other mocks to undefined (not called by default)
    mockGetStoredKey.mockResolvedValue(undefined as any);
    mockGetMnemonic.mockReturnValue(undefined as any);
    mockGetUserKeyPair.mockResolvedValue(undefined as any);
    mockDownloadEncryptedFile.mockResolvedValue(undefined as any);
    mockDecryptSharedFile.mockResolvedValue(undefined as any);
    mockUploadAndSyncFile.mockResolvedValue(undefined as any);
    mockFetchUserPublicKey.mockResolvedValue(undefined as any);
    mockDeleteFileFromStorage.mockResolvedValue(undefined as any);
  });

  describe('Initial Render', () => {
    it('should render the page', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('Shared With Me')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByText('View and access files that have been shared with you')
        ).toBeInTheDocument();
      });
    });

    it('should have refresh button', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      renderWithRouter(<SharedWithMePage />);

      expect(screen.getByText(/checking key status/i)).toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should redirect to home if user not authenticated', async () => {
      mockGetUserEmail.mockResolvedValue(null);

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should redirect to home on authentication error', async () => {
      mockGetUserEmail.mockRejectedValue(new Error('Auth failed'));

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should get user email on mount', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(mockGetUserEmail).toHaveBeenCalled();
      });
    });
  });

  describe('Key Status Check', () => {
    it('should check for RSA keys on mount', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(mockRecoverRsaKeysIfNeeded).toHaveBeenCalledWith(
          'test@example.com',
          false
        );
      });
    });

    it('should show warning when keys not found', async () => {
      mockRecoverRsaKeysIfNeeded.mockResolvedValue({
        success: false,
        keysExisted: false,
        recovered: false,
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Sharing Key Setup Incomplete or Not Found Locally/i)
        ).toBeInTheDocument();
      });
    });

    it('should show key setup buttons when keys missing', async () => {
      mockRecoverRsaKeysIfNeeded.mockResolvedValue({
        success: false,
        keysExisted: false,
        recovered: false,
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /go to key management/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /go to share files/i })
        ).toBeInTheDocument();
      });
    });

    it('should navigate to key management when button clicked', async () => {
      mockRecoverRsaKeysIfNeeded.mockResolvedValue({
        success: false,
        keysExisted: false,
        recovered: false,
      });

      renderWithRouter(<SharedWithMePage />);

      const keyMgmtButton = await screen.findByRole('button', { name: /go to key management/i });
      fireEvent.click(keyMgmtButton);

      expect(mockNavigate).toHaveBeenCalledWith('/key-management');
    });

    it('should navigate to share files when button clicked', async () => {
      mockRecoverRsaKeysIfNeeded.mockResolvedValue({
        success: false,
        keysExisted: false,
        recovered: false,
      });

      renderWithRouter(<SharedWithMePage />);

      const shareButton = await screen.findByRole('button', { name: /go to share files/i });
      fireEvent.click(shareButton);

      expect(mockNavigate).toHaveBeenCalledWith('/share');
    });
  });

  describe('Shared Files Loading', () => {
    it('should load shared files on mount', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(apiClient.sharedFiles.getForUser).toHaveBeenCalledWith(
          'hashed-email'
        );
      });
    });

    it('should display shared files in table', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            drive_file_id: mockSharedFile.driveFileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            file_size: mockSharedFile.fileSize,
            file_mime_type: mockSharedFile.mimeType,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('100.0 KB')).toBeInTheDocument();
      });
    });

    it('should show empty state when no files shared', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByText('No files have been shared with you yet.')
        ).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching files', () => {
      renderWithRouter(<SharedWithMePage />);

      expect(screen.getByText(/checking key status/i)).toBeInTheDocument();
    });

    it('should display file size in KB', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: 'file-1',
            file_id: 'f1',
            file_name: 'large-file.zip',
            sender_hashed_email: 'sender@test.com',
            created_at: '2024-01-15T10:30:00.000Z',
            encrypted_file_key: 'key',
            file_size: 512000,
            file_mime_type: 'application/zip',
            encrypted_file_blob_id: 'blob-1',
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('500.0 KB')).toBeInTheDocument();
      });
    });

    it('should handle files without size', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: 'file-1',
            file_id: 'f1',
            file_name: 'unknown-size.txt',
            sender_hashed_email: 'sender@test.com',
            created_at: '2024-01-15T10:30:00.000Z',
            encrypted_file_key: 'key',
            file_mime_type: 'text/plain',
            encrypted_file_blob_id: 'blob-1',
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });

    it('should handle hex-encoded encrypted keys', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: 'file-1',
            file_id: 'f1',
            file_name: 'hex-key-file.pdf',
            sender_hashed_email: 'sender@test.com',
            created_at: '2024-01-15T10:30:00.000Z',
            encrypted_file_key: '\\x48656c6c6f',
            file_size: 1024,
            file_mime_type: 'application/pdf',
            encrypted_file_blob_id: 'blob-1',
          },
        ],
      });

      mockArrayBufferToBase64.mockReturnValue('SGVsbG8=');

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('hex-key-file.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on load failure', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to load shared files',
          expect.objectContaining({
            description: 'Network error',
          })
        );
      });
    });

    it('should handle unknown errors gracefully', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockRejectedValue(
        'String error'
      );

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to load shared files',
          expect.objectContaining({
            description: 'Unknown error',
          })
        );
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload files when refresh button clicked', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(apiClient.sharedFiles.getForUser).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(apiClient.sharedFiles.getForUser).toHaveBeenCalledTimes(2);
      });
    });

    it('should show loading toast while refreshing', async () => {
      renderWithRouter(<SharedWithMePage />);

      // Wait for initial loading to complete
      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
        expect(refreshButton).not.toBeDisabled();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith('Refreshing shared files...');
      });
    });

    it('should show success toast after refresh', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [],
      });

      renderWithRouter(<SharedWithMePage />);

      // Wait for initial loading to complete
      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
        expect(refreshButton).not.toBeDisabled();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Shared files refreshed');
      }, { timeout: 3000 });
    });

    it('should disable refresh button while loading', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        screen.getByRole('button', { name: /refresh/i });
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(refreshButton).toBeDisabled();
    });
  });

  describe('File Download', () => {
    beforeEach(() => {
      const mockCryptoKey = { type: 'secret' } as CryptoKey;
      mockGetStoredKey.mockResolvedValue(mockCryptoKey);
      mockGetMnemonic.mockReturnValue('test mnemonic phrase words');
      mockGetUserKeyPair.mockResolvedValue({
        publicKeyJwk: { kty: 'RSA', n: 'test', e: 'AQAB' },
        privateKeyJwk: { kty: 'RSA', n: 'test', e: 'AQAB', d: 'secret' },
      });
      mockDownloadEncryptedFile.mockResolvedValue(
        new Blob(['encrypted'], { type: 'application/octet-stream' })
      );
      mockDecryptSharedFile.mockResolvedValue({
        decryptedFile: new Blob(['decrypted'], { type: 'application/pdf' }),
        fileName: 'test-document.pdf',
      });
      mockUploadAndSyncFile.mockResolvedValue({
        id: 'file-123',
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        userEmail: 'test@example.com',
        uploadedDate: new Date(),
        folderId: null,
      });
      (apiClient.sharedFiles.delete as jest.Mock).mockResolvedValue({
        success: true,
      });
    });

    it('should show download button for each file', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            file_size: mockSharedFile.fileSize,
            file_mime_type: mockSharedFile.mimeType,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });
    });

    it('should redirect to key management if no primary key', async () => {
      mockGetStoredKey.mockResolvedValue(null);

      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      const downloadButton = await screen.findByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Primary encryption key required',
          expect.any(Object)
        );
      });
    });

    it('should show processing state during download', async () => {
      // Make download operations slow to observe processing state
      mockDownloadEncryptedFile.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(
          new Blob(['encrypted'], { type: 'application/octet-stream' })
        ), 100))
      );

      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should download and decrypt file successfully', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            file_size: mockSharedFile.fileSize,
            file_mime_type: mockSharedFile.mimeType,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });

      // Mock document.createElement for download link AFTER render
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => {
          if (tagName === 'a') {
            return mockLink as any;
          }
          return originalCreateElement(tagName);
        });
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockDownloadEncryptedFile).toHaveBeenCalledWith(mockSharedFile.fileId);
        expect(mockDecryptSharedFile).toHaveBeenCalled();
      }, { timeout: 3000 });

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should handle download errors gracefully', async () => {
      mockDownloadEncryptedFile.mockRejectedValue(new Error('Download failed'));

      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Download or Decryption Failed',
          expect.any(Object)
        );
      }, { timeout: 3000 });
    });
  });

  describe('Privacy Information', () => {
    it('should display secure file download information', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/About Secure File Downloads/i)
        ).toBeInTheDocument();
      });
    });

    it('should explain decryption process', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Files are downloaded and decrypted securely in your browser/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', async () => {
      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should have semantic table structure', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: mockSharedFile.id,
            file_id: mockSharedFile.fileId,
            file_name: mockSharedFile.originalFileName,
            sender_hashed_email: mockSharedFile.sender,
            created_at: mockSharedFile.createdAt,
            encrypted_file_key: mockSharedFile.encryptedFileKey,
            file_size: mockSharedFile.fileSize,
            file_mime_type: mockSharedFile.mimeType,
            encrypted_file_blob_id: mockSharedFile.encrypted_file_blob_id,
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Multiple Files', () => {
    it('should display multiple shared files', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: 'file-1',
            file_id: 'f1',
            file_name: 'document1.pdf',
            sender_hashed_email: 'sender1@test.com',
            created_at: '2024-01-15T10:30:00.000Z',
            encrypted_file_key: 'key1',
            file_size: 1024,
            file_mime_type: 'application/pdf',
            encrypted_file_blob_id: 'blob-1',
          },
          {
            id: 'file-2',
            file_id: 'f2',
            file_name: 'document2.docx',
            sender_hashed_email: 'sender2@test.com',
            created_at: '2024-01-16T11:30:00.000Z',
            encrypted_file_key: 'key2',
            file_size: 2048,
            file_mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            encrypted_file_blob_id: 'blob-2',
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        expect(screen.getByText('document1.pdf')).toBeInTheDocument();
        expect(screen.getByText('document2.docx')).toBeInTheDocument();
      });
    });

    it('should have separate download buttons for each file', async () => {
      (apiClient.sharedFiles.getForUser as jest.Mock).mockResolvedValue({
        success: true,
        files: [
          {
            id: 'file-1',
            file_id: 'f1',
            file_name: 'document1.pdf',
            sender_hashed_email: 'sender@test.com',
            created_at: '2024-01-15T10:30:00.000Z',
            encrypted_file_key: 'key1',
            encrypted_file_blob_id: 'blob-1',
          },
          {
            id: 'file-2',
            file_id: 'f2',
            file_name: 'document2.pdf',
            sender_hashed_email: 'sender@test.com',
            created_at: '2024-01-16T10:30:00.000Z',
            encrypted_file_key: 'key2',
            encrypted_file_blob_id: 'blob-2',
          },
        ],
      });

      renderWithRouter(<SharedWithMePage />);

      await waitFor(() => {
        const downloadButtons = screen.getAllByRole('button', { name: /download/i });
        expect(downloadButtons.length).toBe(2);
      });
    });
  });
});
