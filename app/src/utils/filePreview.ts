import { decryptFile } from "./decryptFile";
import { getStoredKey } from "./cryptoUtils";

// Previewable MIME types
const PREVIEWABLE_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp3",
  "audio/webm",
  // PDFs
  "application/pdf",
  // Text
  "text/plain",
  "application/json",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
];

/**
 * Check if a file type is previewable
 */
export function isPreviewable(mimeType: string): boolean {
  return PREVIEWABLE_MIME_TYPES.includes(mimeType);
}

/**
 * Get the preview type for a given MIME type
 */
export function getPreviewType(
  mimeType: string
):
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "unsupported" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript"
  )
    return "text";
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
