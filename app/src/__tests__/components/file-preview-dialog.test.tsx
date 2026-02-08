/**
 * Unit Tests for FilePreviewDialog Component
 * Tests file preview dialog with various file types, decryption, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilePreviewDialog } from '../../components/storage/file-preview-dialog';
import {
  decryptFileForPreview,
  getPreviewType,
  readTextFromBlob,
} from '../../utils/filePreview';
import { getFileIconPath } from '../../lib/mime-types';

// Mock all dependencies
jest.mock('../../utils/filePreview');
jest.mock('../../lib/mime-types');

// Mock Radix UI Dialog
jest.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children, ...props }: any) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  ),
  Title: ({ children }: any) => <h2>{children}</h2>,
  Close: ({ children, ...props }: any) => (
    <button {...props} aria-label="Close">
      {children}
    </button>
  ),
}));
jest.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess, file }: any) => {
    // Simulate successful PDF load after a tick
    React.useEffect(() => {
      if (file) {
        setTimeout(() => onLoadSuccess({ numPages: 3 }), 0);
      }
    }, [file, onLoadSuccess]);
    return <div data-testid="mock-pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid="mock-pdf-page">Page {pageNumber}</div>
  ),
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

// Mock mammoth for DOCX preview
jest.mock('mammoth', () => ({
  convertToHtml: jest.fn().mockResolvedValue({ value: '<p>DOCX Content</p>' }),
}));

// Mock xlsx for spreadsheet preview
jest.mock('xlsx', () => ({
  read: jest.fn().mockReturnValue({
    Sheets: { Sheet1: {} },
    SheetNames: ['Sheet1'],
  }),
  utils: {
    sheet_to_html: jest.fn().mockReturnValue('<table><tr><td>Cell</td></tr></table>'),
  },
}));

const mockDecryptFileForPreview = decryptFileForPreview as jest.MockedFunction<
  typeof decryptFileForPreview
>;
const mockGetPreviewType = getPreviewType as jest.MockedFunction<typeof getPreviewType>;
const mockReadTextFromBlob = readTextFromBlob as jest.MockedFunction<typeof readTextFromBlob>;
const mockGetFileIconPath = getFileIconPath as jest.MockedFunction<typeof getFileIconPath>;

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('FilePreviewDialog Component', () => {
  const defaultProps = {
    fileId: 'file-123',
    fileName: 'test.txt',
    mimeType: 'text/plain',
    open: true,
    onOpenChange: jest.fn(),
    onDownload: jest.fn(),
  };

  const mockBlob = new Blob(['test content'], { type: 'text/plain' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFileIconPath.mockReturnValue('/icons/file.svg');
  });

  describe('Dialog State Management', () => {
    it('should render dialog when open is true', () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} />);

      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      mockGetPreviewType.mockReturnValue('text');

      render(<FilePreviewDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('should call onOpenChange when dialog is closed', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} />);

      // Find and click the close button (X button in dialog)
      const closeButton = document.querySelector('[aria-label="Close"]');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      }
    });

    it('should cleanup blob URL when dialog closes', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });

      const { unmount } = render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockDecryptFileForPreview).toHaveBeenCalled();
      });

      unmount();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('File Decryption', () => {
    it('should decrypt file when dialog opens', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockDecryptFileForPreview).toHaveBeenCalledWith(
          'file-123',
          'test.txt',
          'text/plain'
        );
      });
    });

    it('should show loading state while decrypting', () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<FilePreviewDialog {...defaultProps} />);

      expect(screen.getByText(/decrypting file/i)).toBeInTheDocument();
      expect(screen.getByText(/decrypting file/i).closest('div')).toContainHTML('animate-spin');
    });

    it('should not decrypt again if already decrypted', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });

      const { rerender } = render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockDecryptFileForPreview).toHaveBeenCalledTimes(1);
      });

      // Rerender with same props
      rerender(<FilePreviewDialog {...defaultProps} />);

      // Should not call decrypt again
      expect(mockDecryptFileForPreview).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should display 404 error message', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('HTTP error: 404'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/preview failed/i)).toBeInTheDocument();
        expect(screen.getByText(/file not found on google drive/i)).toBeInTheDocument();
      });
    });

    it('should display wrong encryption key error', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error("key doesn't match"));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/wrong encryption key/i)).toBeInTheDocument();
      });
    });

    it('should display missing encryption key error', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('No encryption key found'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/encryption key missing/i)).toBeInTheDocument();
      });
    });

    it('should display invalid key format error', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('Invalid encryption key format'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/invalid encryption key/i)).toBeInTheDocument();
      });
    });

    it('should display authentication error', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('Authentication error'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/authentication error/i)).toBeInTheDocument();
      });
    });

    it('should display generic error message', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('Unknown error occurred'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/unknown error occurred/i)).toBeInTheDocument();
      });
    });

    it('should show error icon when preview fails', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockRejectedValue(new Error('Test error'));

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        const errorIcon = screen.getByText(/preview failed/i).parentElement?.querySelector('svg');
        expect(errorIcon).toBeInTheDocument();
      });
    });
  });

  describe('Image Preview', () => {
    it('should render image preview', async () => {
      mockGetPreviewType.mockReturnValue('image');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-image',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="photo.jpg" mimeType="image/jpeg" />);

      await waitFor(() => {
        const img = screen.getByAltText('photo.jpg');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'blob:mock-image');
      });
    });
  });

  describe('Video Preview', () => {
    it('should render video preview', async () => {
      mockGetPreviewType.mockReturnValue('video');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-video',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="video.mp4" mimeType="video/mp4" />);

      await waitFor(() => {
        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', 'blob:mock-video');
        expect(video).toHaveAttribute('controls');
      });
    });
  });

  describe('Audio Preview', () => {
    it('should render audio preview', async () => {
      mockGetPreviewType.mockReturnValue('audio');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-audio',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="song.mp3" mimeType="audio/mpeg" />);

      await waitFor(() => {
        const audio = document.querySelector('audio');
        expect(audio).toBeInTheDocument();
        expect(audio).toHaveAttribute('src', 'blob:mock-audio');
        expect(audio).toHaveAttribute('controls');
      });
    });
  });

  describe('PDF Preview', () => {
    it('should render PDF preview', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-pdf-document')).toBeInTheDocument();
      });
    });

    it('should show page navigation for multi-page PDFs', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/previous/i)).toBeInTheDocument();
      expect(screen.getByText(/next/i)).toBeInTheDocument();
    });

    it('should navigate to next page in PDF', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByText(/next/i);
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it('should navigate to previous page in PDF', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      // Go to page 2 first
      fireEvent.click(screen.getByText(/next/i));

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });

      // Go back to page 1
      fireEvent.click(screen.getByText(/previous/i));

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it('should disable previous button on first page', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      const previousButton = screen.getByText(/previous/i);
      expect(previousButton).toBeDisabled();
    });

    it('should disable next button on last page', async () => {
      mockGetPreviewType.mockReturnValue('pdf');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-pdf',
        blob: mockBlob,
      });

      render(<FilePreviewDialog {...defaultProps} fileName="doc.pdf" mimeType="application/pdf" />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });

      // Navigate to last page
      const nextButton = screen.getByText(/next/i);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();
      });

      expect(nextButton).toBeDisabled();
    });
  });

  describe('Text Preview', () => {
    it('should render text preview', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-text',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('Hello, World!');

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(mockReadTextFromBlob).toHaveBeenCalledWith(mockBlob);
        expect(screen.getByText('Hello, World!')).toBeInTheDocument();
      });
    });

    it('should display text in pre tag', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-text',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('Code\n  with\n    indentation');

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        const pre = document.querySelector('pre');
        expect(pre).toBeInTheDocument();
        expect(pre).toHaveTextContent('Code\n  with\n    indentation');
      });
    });
  });

  describe('DOCX Preview', () => {
    it('should render DOCX preview', async () => {
      mockGetPreviewType.mockReturnValue('docx');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-docx',
        blob: mockBlob,
      });

      render(
        <FilePreviewDialog
          {...defaultProps}
          fileName="document.docx"
          mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DOCX Content')).toBeInTheDocument();
      });
    });
  });

  describe('Spreadsheet Preview', () => {
    it('should render spreadsheet preview', async () => {
      mockGetPreviewType.mockReturnValue('spreadsheet');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-xlsx',
        blob: mockBlob,
      });

      render(
        <FilePreviewDialog
          {...defaultProps}
          fileName="sheet.xlsx"
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cell')).toBeInTheDocument();
      });
    });
  });

  describe('Unsupported File Types', () => {
    it('should show unsupported message for unknown file types', async () => {
      mockGetPreviewType.mockReturnValue('unsupported');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-file',
        blob: mockBlob,
      });

      render(
        <FilePreviewDialog
          {...defaultProps}
          fileName="archive.zip"
          mimeType="application/zip"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/preview not available for this file type/i)).toBeInTheDocument();
        expect(screen.getByText(/download the file to open it/i)).toBeInTheDocument();
      });
    });

    it('should show file icon for unsupported types', async () => {
      mockGetPreviewType.mockReturnValue('unsupported');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-file',
        blob: mockBlob,
      });
      mockGetFileIconPath.mockReturnValue('/icons/zip.svg');

      render(
        <FilePreviewDialog
          {...defaultProps}
          fileName="archive.zip"
          mimeType="application/zip"
        />
      );

      await waitFor(() => {
        const icon = document.querySelector('img[src="/icons/zip.svg"]');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Download Functionality', () => {
    it('should call onDownload when download button is clicked', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('Test content');

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test content')).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      expect(defaultProps.onDownload).toHaveBeenCalledTimes(1);
    });

    it('should close dialog when download is clicked', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('Test content');

      render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test content')).toBeInTheDocument();
      });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should disable download button while decrypting', () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<FilePreviewDialog {...defaultProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDisabled();
    });
  });

  describe('State Cleanup', () => {
    it('should reset state when dialog closes', async () => {
      mockGetPreviewType.mockReturnValue('text');
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:mock-url',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('Test content');

      const { rerender } = render(<FilePreviewDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test content')).toBeInTheDocument();
      });

      // Close dialog
      rerender(<FilePreviewDialog {...defaultProps} open={false} />);

      // Reopen dialog with new file
      mockDecryptFileForPreview.mockResolvedValue({
        blobUrl: 'blob:new-url',
        blob: mockBlob,
      });
      mockReadTextFromBlob.mockResolvedValue('New content');

      rerender(
        <FilePreviewDialog {...defaultProps} fileId="new-file" fileName="new.txt" open={true} />
      );

      // Should decrypt the new file
      await waitFor(() => {
        expect(mockDecryptFileForPreview).toHaveBeenCalledWith('new-file', 'new.txt', 'text/plain');
      });
    });
  });
});
