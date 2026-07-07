import React from "react";
export type MimeTypeCategory =
  | "Images"
  | "PDFs"
  | "Text"
  | "Archives"
  | "Videos"
  | "Audio"
  | "Spreadsheets"
  | "Presentations"
  | "Others";

export const iconMap: Record<string, JSX.Element> = {
  "application/pdf": <img src="006-pdf.png" alt="PDF Icon" width="50px" />,
  "text/plain": <img src="005-txt-file.png" alt="TEXT Icon" width="50px" />,
  "application/json": (
    <img src="007-source-code.png" alt="CODE Icon" width="50px" />
  ),
  "application/zip": <img src="004-zip-file.png" alt="ZIP Icon" width="50px" />,
  "application/x-7z-compressed": (
    <img src="004-zip-file.png" alt="ZIP Icon" width="50px" />
  ),
  "video/mp4": <img src="008-video.png" alt="VIDEO Icon" width="50px" />,
  "audio/mpeg": <img src="003-audio.png" alt="AUDIO Icon" width="50px" />,
  "audio/wav": <img src="003-audio.png" alt="AUDIO Icon" width="50px" />,
  "image/jpeg": <img src="009-img.png" alt="IMG Icon" width="50px" />,
  "image/png": <img src="002-png.png" alt="IMG Icon" width="50px" />,
  "image/gif": <img src="010-gif.png" alt="GIF Icon" width="50px" />,
  "image/webp": <img src="009-img.png" alt="IMG Icon" width="50px" />,
  "image/svg+xml": <img src="009-img.png" alt="IMG Icon" width="50px" />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
    <img src="001-excel.png" alt="EXCEL Icon" width="50px" />
  ),
  "application/vnd.ms-excel": (
    <img src="001-excel.png" alt="EXCEL Icon" width="50px" />
  ),
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
    <img src="ppt.png" alt="PPT Icon" width="50px" />
  ),
  "application/vnd.ms-powerpoint": (
    <img src="ppt.png" alt="PPT Icon" width="50px" />
  ),
};

const fileIconPathMap: Record<string, string> = {
  "application/pdf": "/006-pdf.png",
  "text/plain": "/005-txt-file.png",
  "text/xml": "/007-source-code.png",
  "application/xml": "/007-source-code.png",
  "application/json": "/007-source-code.png",
  "application/zip": "/004-zip-file.png",
  "application/x-7z-compressed": "/004-zip-file.png",
  "application/x-rar-compressed": "/004-zip-file.png",
  "video/mp4": "/008-video.png",
  "video/webm": "/008-video.png",
  "video/quicktime": "/008-video.png",
  "audio/mpeg": "/003-audio.png",
  "audio/wav": "/003-audio.png",
  "audio/ogg": "/003-audio.png",
  "image/jpeg": "/009-img.png",
  "image/png": "/002-png.png",
  "image/gif": "/010-gif.png",
  "image/webp": "/009-img.png",
  "image/svg+xml": "/009-img.png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "/001-excel.png",
  "application/vnd.ms-excel": "/001-excel.png",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "/ppt.png",
  "application/vnd.ms-powerpoint": "/ppt.png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "/005-txt-file.png",
  "application/msword": "/005-txt-file.png",
};

export function getFileIconPath(mimeType: string): string {
  if (fileIconPathMap[mimeType]) return fileIconPathMap[mimeType];
  if (mimeType.startsWith("image/")) return "/009-img.png";
  if (mimeType.startsWith("video/")) return "/008-video.png";
  if (mimeType.startsWith("audio/")) return "/003-audio.png";
  if (mimeType.startsWith("text/")) return "/005-txt-file.png";
  return "/005-txt-file.png";
}

export const mimeTypeCategories: Record<MimeTypeCategory, string[]> = {
  Images: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  PDFs: ["application/pdf"],
  Text: ["text/plain", "application/json"],
  Archives: ["application/zip", "application/x-7z-compressed"],
  Videos: ["video/mp4"],
  Audio: ["audio/mpeg", "audio/wav"],
  Spreadsheets: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  Presentations: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  Others: [],
};
