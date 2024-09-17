import React from "react";
import {
  FaImages,
  FaRegFilePdf,
  FaRegFileLines,
  FaRegFileCode,
  FaRegFileZipper,
  FaRegFileVideo,
  FaRegFileAudio,
  FaRegFileExcel,
  FaRegFilePowerpoint,
} from "react-icons/fa6";

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
