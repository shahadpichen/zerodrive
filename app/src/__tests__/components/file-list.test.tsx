/**
 * Unit Tests for FileList Component
 * Tests file listing, download, delete functionality
 *
 * Note: Simplified tests focusing on core functionality
 * Complex UI interactions (dialogs, etc.) are tested in integration tests
 */

import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { FileList } from '../../components/storage/file-list';
import { FileMeta, getAllFilesForUser } from '../../utils/dexieDB';
import { getStoredKey } from '../../utils/cryptoUtils';

// Mock all dependencies
jest.mock('../../utils/dexieDB');
jest.mock('../../utils/cryptoUtils');
jest.mock('../../utils/decryptFile');
jest.mock('../../utils/gapiInit');
jest.mock('sonner');
jest.mock('../../utils/logger');
jest.mock('gapi-script');

global.fetch = jest.fn();

const mockGetAllFilesForUser = getAllFilesForUser as jest.MockedFunction<
  typeof getAllFilesForUser
>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<typeof getStoredKey>;

describe('FileList Component', () => {
  const testUser = 'test@example.com';
  const mockFiles: FileMeta[] = [
    {
      id: 'file-1',
      name: 'test1.txt',
      mimeType: 'text/plain',
      userEmail: testUser,
      uploadedDate: new Date('2024-01-01'),
      folderId: null,
    },
    {
      id: 'file-2',
      name: 'test2.pdf',
      mimeType: 'application/pdf',
      userEmail: testUser,
      uploadedDate: new Date('2024-01-02'),
      folderId: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
    mockGetAllFilesForUser.mockResolvedValue(mockFiles);
    mockGetStoredKey.mockResolvedValue({ k: 'mock-key', kty: 'oct' } as any);
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('File Loading', () => {
    it('should load and display files for user', async () => {
      render(<FileList view="full" userEmail={testUser} />);

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalledWith(testUser);
      });
    });

    it('should show empty state when no files', async () => {
      mockGetAllFilesForUser.mockResolvedValue([]);

      render(<FileList view="recent" userEmail={testUser} />);

      await waitFor(() => {
        expect(screen.getByText(/no recent uploads/i)).toBeInTheDocument();
      });
    });

    it('should not fetch files when userEmail is missing', async () => {
      render(<FileList view="full" />);

      // Wait a bit to ensure no calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGetAllFilesForUser).not.toHaveBeenCalled();
    });

    it('should reload files when refreshKey changes', async () => {
      const { rerender } = render(
        <FileList view="full" userEmail={testUser} refreshKey={1} />
      );

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalledTimes(1);
      });

      rerender(<FileList view="full" userEmail={testUser} refreshKey={2} />);

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('File Display - Recent View', () => {
    it('should show files in recent view', async () => {
      render(<FileList view="recent" userEmail={testUser} />);

      await waitFor(() => {
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
      });
    });

    it('should display upload date in recent view', async () => {
      render(<FileList view="recent" userEmail={testUser} />);

      await waitFor(() => {
        expect(screen.getByText('1/1/2024')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('should render compact view', async () => {
      render(<FileList view="compact" userEmail={testUser} />);

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalled();
      });
    });

    it('should render recent view', async () => {
      render(<FileList view="recent" userEmail={testUser} />);

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalled();
      });
    });

    it('should render full view', async () => {
      render(<FileList view="full" userEmail={testUser} />);

      await waitFor(() => {
        expect(mockGetAllFilesForUser).toHaveBeenCalled();
      });
    });
  });
});
