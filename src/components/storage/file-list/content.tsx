import React from "react";
import { FileMeta } from "../../../utils/dexieDB";
import { Button } from "../../ui/button";
import { Loader2 } from "lucide-react";
import { FaRegFileLines } from "react-icons/fa6";
import { MdOutlineCloudUpload } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import Spinner from "../../ui/spinner";
import { DataTable } from "../../ui/data-table";
import { columns } from "./columns";
import { iconMap } from "../../../lib/mime-types";

interface ContentProps {
  isLoadingFiles: boolean;
  filteredFiles: FileMeta[];
  isOn: boolean;
  downloadAndDecryptFile: (fileId: string, fileName: string) => void;
  downloadingFileId: string | null;
  droppedFiles: File[];
  loading: boolean;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  uploadDroppedFiles: () => void;
  handleCancelUpload: () => void;
}

export const FileListContent: React.FC<ContentProps> = ({
  isLoadingFiles,
  filteredFiles,
  isOn,
  downloadAndDecryptFile,
  downloadingFileId,
  droppedFiles,
  loading,
  handleDrop,
  handleDragOver,
  uploadDroppedFiles,
  handleCancelUpload,
}) => {
  const getIconForMimeType = (mimeType: string) => {
    return iconMap[mimeType] || <FaRegFileLines />;
  };

  if (isLoadingFiles) {
    return (
      <div
        className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4"
        style={{ height: "calc(100vh - 34vh)" }}
      >
        <Spinner />
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div
        className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4"
        style={{ height: "calc(100vh - 34vh)" }}
      >
        <p>No files available</p>
      </div>
    );
  }

  return (
    <div
      className="h-full p-4 w-full rounded-lg mt-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {isOn ? (
        <DataTable
          columns={columns}
          data={filteredFiles}
          meta={{
            downloadingFileId,
            downloadAndDecryptFile,
          }}
        />
      ) : (
        <ul className="flex gap-3 flex-wrap">
          {filteredFiles.map((file) => (
            <li key={file.id} className="relative">
              <Button
                className="h-36 w-36 md:h-40 md:w-40 bg-transparent flex flex-col gap-3 overflow-hidden rounded-md border-0 hover:bg-zinc-400/10 shadow-none"
                onClick={() => downloadAndDecryptFile(file.id, file.name)}
                disabled={downloadingFileId === file.id}
                variant="outline"
              >
                <div className="h-[70%] rounded-xl text-6xl w-full flex items-center justify-center">
                  {getIconForMimeType(file.mimeType)}
                </div>
                <div className="h-[30%] max-w-full">
                  <p className="flex text-sm items-center truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {file.uploadedDate?.toLocaleString().split(",")[0]}
                  </p>
                </div>
              </Button>
              <div className="absolute top-4 right-4">
                {downloadingFileId === file.id ? (
                  <Loader2 className="animate-spin size-4" />
                ) : (
                  ""
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {droppedFiles.length > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            onClick={uploadDroppedFiles}
            variant="outline"
            className="absolute flex flex-col text-2xl font-semibold w-full h-full bg-black/20 top-0 hover:bg-black/25"
            disabled={loading}
          >
            <MdOutlineCloudUpload className="text-8xl" />
            {loading ? "Uploading..." : "Click to Upload Files"}
          </Button>
          <Button
            onClick={handleCancelUpload}
            variant="ghost"
            className="absolute top-2 right-2 hover:bg-transparent"
            disabled={loading}
          >
            <RxCross2 className="text-2xl" />
          </Button>
        </div>
      )}
    </div>
  );
};
