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
  "application/pdf": <FaRegFilePdf />,
  "text/plain": <FaRegFileLines />,
  "application/json": <FaRegFileCode />,
  "application/zip": <FaRegFileZipper />,
  "application/x-7z-compressed": <FaRegFileZipper />,
  "video/mp4": <FaRegFileVideo />,
  "audio/mpeg": <FaRegFileAudio />,
  "audio/wav": <FaRegFileAudio />,
  "image/jpeg": <FaImages />,
  "image/png": <FaImages />,
  "image/gif": <FaImages />,
  "image/webp": <FaImages />,
  "image/svg+xml": <FaImages />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
    <FaRegFileExcel />
  ),
  "application/vnd.ms-excel": <FaRegFileExcel />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
    <FaRegFilePowerpoint />
  ),
  "application/vnd.ms-powerpoint": <FaRegFilePowerpoint />,
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
