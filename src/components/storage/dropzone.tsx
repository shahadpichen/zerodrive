import React from "react";
import { Input } from "../ui/input";
import FileNamesDisplay from "./file-names-display";

interface DropzoneProps {
  fileNames: string[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ fileNames, onFileChange }) => (
  <form
    action="/file-upload"
    className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg min-h-32 py-5 bg-gray-100 relative cursor-pointer hover:bg-gray-200"
    id="my-awesome-dropzone"
  >
    <Input
      type="file"
      onChange={onFileChange}
      multiple
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    />
    <FileNamesDisplay fileNames={fileNames} />
  </form>
);

export default Dropzone;
