import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  decryptFileForPreview,
  getPreviewType,
  readTextFromBlob,
} from "../../utils/filePreview";
import { Loader2, Download, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker - must be set before any PDF rendering
pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;

interface FilePreviewDialogProps {
  fileId: string;
  fileName: string;
  mimeType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}

export const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  fileId,
  fileName,
  mimeType,
  open,
  onOpenChange,
  onDownload,
}) => {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [spreadsheetHtml, setSpreadsheetHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const previewType = getPreviewType(mimeType, fileName);

  // Decrypt file when dialog opens
  useEffect(() => {
    if (open && !blobUrl && !error && !isDecrypting) {
      decryptAndPreview();
    }
  }, [open, fileId]);

  // Cleanup blob URL when dialog closes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const decryptAndPreview = async () => {
    setIsDecrypting(true);
    setError(null);

    try {
      const result = await decryptFileForPreview(fileId, fileName, mimeType);
      setBlobUrl(result.blobUrl);
      setBlob(result.blob);

      // For text files, read the content
      if (previewType === "text") {
        const content = await readTextFromBlob(result.blob);
        setTextContent(content);
      }

      if (previewType === "docx") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await result.blob.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(value);
      }

      if (previewType === "spreadsheet") {
        const XLSX = await import("xlsx");
        const arrayBuffer = await result.blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const html = XLSX.utils.sheet_to_html(firstSheet);
        setSpreadsheetHtml(html);
      }
    } catch (err: any) {
      console.error("Preview error:", err);

      const errorMessage = err.message || "Unknown error";

      if (errorMessage.includes("HTTP error: 404") || errorMessage.includes("404")) {
        setError("File not found on Google Drive. It may have been deleted outside the app. Try re-uploading the file.");
      } else if (errorMessage.includes("key doesn't match")) {
        setError("Wrong encryption key. The key you're using doesn't match the one used to encrypt this file.");
      } else if (errorMessage.includes("No encryption key found")) {
        setError("Encryption key missing. Please upload your encryption key first.");
      } else if (errorMessage.includes("Invalid encryption key format")) {
        setError("Invalid encryption key. Your stored encryption key appears to be corrupted.");
      } else if (errorMessage.includes("Authentication error")) {
        setError("Authentication error. Please sign in again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleClose = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    setBlobUrl(null);
    setBlob(null);
    setTextContent(null);
    setDocxHtml(null);
    setSpreadsheetHtml(null);
    setError(null);
    setIsDecrypting(false);
    setNumPages(0);
    setPageNumber(1);
    onOpenChange(false);
  };

  const handleDownload = () => {
    handleClose();
    onDownload();
  };

  const renderPreviewContent = () => {
    if (isDecrypting) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Decrypting file...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center space-y-2">
            <p className="font-medium">Preview Failed</p>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
        </div>
      );
    }

    if (!blobUrl) {
      return null;
    }

    switch (previewType) {
      case "image":
        return (
          <div className="flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
            <img
              src={blobUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        );

      case "video":
        return (
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              src={blobUrl}
              controls
              className="w-full max-h-[70vh]"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center justify-center py-12">
            <audio src={blobUrl} controls className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case "pdf":
        return (
          <div className="bg-muted/30 rounded-lg overflow-hidden p-4">
            <div className="flex flex-col items-center">
              <Document
                file={blob}
                onLoadSuccess={({ numPages }: { numPages: number }) => {
                  setNumPages(numPages);
                  setPageNumber(1);
                }}
                onLoadError={(error) => {
                  console.error("PDF load error:", error);
                  setError("Failed to load PDF. The file may be corrupted.");
                }}
                loading={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={Math.min(window.innerWidth * 0.7, 800)}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  }
                />
              </Document>

              {numPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4 pb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                    Page {pageNumber} of {numPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case "text":
        return (
          <div className="bg-muted/30 rounded-lg overflow-hidden">
            <pre className="p-4 text-sm overflow-auto max-h-[70vh] whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          </div>
        );

      case "docx":
        return (
          <div className="bg-white rounded-lg p-6 overflow-auto max-h-[70vh] prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: docxHtml || "" }} />
          </div>
        );

      case "spreadsheet":
        return (
          <div className="bg-white rounded-lg overflow-auto max-h-[70vh]">
            <div
              dangerouslySetInnerHTML={{ __html: spreadsheetHtml || "" }}
              className="[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:bg-gray-100 [&_th]:font-medium"
            />
          </div>
        );

      case "unsupported":
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <p className="font-medium">Preview Not Available</p>
              <p className="text-sm text-muted-foreground">
                This file type cannot be previewed. You can download it to view.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {renderPreviewContent()}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            onClick={handleDownload}
            variant="default"
            disabled={isDecrypting}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
