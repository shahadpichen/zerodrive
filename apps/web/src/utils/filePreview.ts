import { decryptFile } from "./decryptFile";
import { getStoredKey } from "./cryptoUtils";

// Extension-to-MIME fallback for files with missing/incorrect MIME types
const EXTENSION_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogg": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".json": "application/json",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".xml": "text/xml",
};

function getMimeFromExtension(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return undefined;
  const ext = fileName.substring(dotIndex).toLowerCase();
  return EXTENSION_MIME_MAP[ext];
}

/**
 * Check if a file type is previewable
 */
export function isPreviewable(mimeType: string, fileName?: string): boolean {
  return getPreviewType(mimeType, fileName) !== "unsupported";
}

/**
 * Get the preview type for a given MIME type
 */
export function getPreviewType(
  mimeType: string,
  fileName?: string
):
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "docx"
  | "spreadsheet"
  | "unsupported" {
  // Use extension-based fallback if mimeType is empty or generic
  const effective =
    !mimeType || mimeType === "application/octet-stream"
      ? (fileName && getMimeFromExtension(fileName)) || mimeType
      : mimeType;
  if (effective.startsWith("image/")) return "image";
  if (effective.startsWith("video/")) return "video";
  if (effective.startsWith("audio/")) return "audio";
  if (effective === "application/pdf") return "pdf";
  if (
    effective.startsWith("text/") ||
    effective === "application/json" ||
    effective === "application/javascript" ||
    effective === "application/xml"
  )
    return "text";
  if (
    effective === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    effective === "application/msword"
  )
    return "docx";
  if (
    effective === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    effective === "application/vnd.ms-excel"
  )
    return "spreadsheet";
  return "unsupported";
}

/**
 * Decrypt a file for preview (returns blob URL)
 * Similar to downloadAndDecryptFile but returns blob URL instead of downloading
 */
export async function decryptFileForPreview(
  fileId: string,
  fileName: string,
  mimeType: string
): Promise<{ blobUrl: string; blob: Blob; mimeType?: string }> {
  // Check for encryption key
  const key = await getStoredKey();
  if (!key) {
    throw new Error("No encryption key found");
  }

  // Get Google access token
  const { getGoogleAccessToken } = await import("./gapiInit");
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error("Authentication error");
  }

  // Fetch encrypted file from Google Drive
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      method: "GET",
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.statusText || `HTTP error: ${response.status}`}`
    );
  }

  const encryptedBlob = await response.blob();

  // Decrypt the file
  const decryptedBlob = await decryptFile(encryptedBlob);

  // Create blob with correct MIME type
  const typedBlob = new Blob([decryptedBlob], { type: mimeType });
  const blobUrl = URL.createObjectURL(typedBlob);

  return {
    blobUrl,
    blob: typedBlob,
    mimeType,
  };
}

/**
 * Read text content from a blob
 */
export async function readTextFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file content"));
    reader.readAsText(blob);
  });
}
