import React from "react";
import { Input } from "../../ui/input";
import { EncryptedFileUploader } from "../file-uploader";
import { IoSearchOutline } from "react-icons/io5";
import { Button } from "../../ui/button";
import { SlGrid, SlList } from "react-icons/sl";
import { Separator } from "../../ui/separator";
interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isOn: boolean;
  setIsOn: (isOn: boolean) => void;
}

export const FileListHeader: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  isOn,
  setIsOn,
}) => {
  const handleToggle = () => setIsOn(!isOn);

  return (
    <div className="relative flex justify-between w-full h-fit mb-3 border-b pb-3">
      <IoSearchOutline className="absolute left-0 top-[13px] text-gray-500 text-lg" />
      <div className="flex flex-col justify-center gap-5 items-center w-[80vw] md:w-[65vw]">
        <Input
          type="text"
          placeholder=" Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-5 pl-6 text-base bg-white border-white shadow-none focus:outline-none focus:border-transparent focus-visible:ring-0"
        />
      </div>
      <div className="flex items-center gap-4">
        <EncryptedFileUploader />
        <Separator orientation="vertical" className="hidden md:block" />
        <div className="hidden md:flex gap-1">
          <Button
            className="p-3 rounded-none flex items-center gap-2"
            variant={isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlList /> <span className="hidden md:block">List</span>
          </Button>
          <Button
            className="p-3 rounded-none flex items-center gap-2"
            variant={!isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlGrid /> <span className="hidden md:block">Grid</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
