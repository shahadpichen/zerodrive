import React from "react";
import { Input } from "../ui/input";
import FileNamesDisplay from "./file-names-display";
import { FcFile } from "react-icons/fc";
import { RiUploadCloudFill } from "react-icons/ri";
import { CiFileOn } from "react-icons/ci";

interface DropzoneProps {
  fileNames: string[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ fileNames, onFileChange }) => (
  <form
    action="/file-upload"
    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg min-h-40 p-6 relative cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-primary/5"
    id="my-awesome-dropzone"
  >
    <Input
      type="file"
      onChange={onFileChange}
      multiple
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      aria-label="File upload dropzone"
    />

    {fileNames.length === 0 ? (
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <div className="relative">
          <CiFileOn className="w-10 h-10" />
          <RiUploadCloudFill className="w-6 h-6 absolute -bottom-1 right-0 text-black" />
        </div>
        <div className="text-center ">
          <p className="font-medium text-sm text-black">
            Select a file or drag and drop here
          </p>
          <p className="text-xs text-gray-500">All file types supported</p>
        </div>
      </div>
    ) : (
      <FileNamesDisplay fileNames={fileNames} />
    )}
  </form>
);

export default Dropzone;
