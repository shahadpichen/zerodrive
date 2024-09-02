import React, { useState, useEffect } from "react";
import { FileMeta, getAllFilesForUser, addFile } from "../../utils/dexieDB";
import { gapi } from "gapi-script";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { KeyManagement } from "./download-key";
import { EncryptedFileUploader } from "./file-uploader";
import { SlGrid, SlList } from "react-icons/sl";
import { MdOutlineCloudUpload } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

import { decryptFile } from "../../utils/decryptFile";
import { FaRegFileLines } from "react-icons/fa6";
import {
  MimeTypeCategory,
  iconMap,
  mimeTypeCategories,
} from "../../lib/mime-types";
import { encryptFile } from "../../utils/encryptFile";
import { getStoredKey } from "../../utils/cryptoUtils";

export const FileList: React.FC = () => {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMeta[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<MimeTypeCategory | "All Files">(
    "All Files"
  );
  const [availableFilters, setAvailableFilters] = useState<
    (MimeTypeCategory | "All Files")[]
  >([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const initClient = () => {
      gapi.client
        .init({
          clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          const profile = authInstance.currentUser.get().getBasicProfile();
          setUserEmail(profile.getEmail());
        });
    };
    gapi.load("client:auth2", initClient);
  }, []);

  useEffect(() => {
    const fetchFiles = async () => {
      if (userEmail) {
        const files = await getAllFilesForUser(userEmail);
        setFiles(files);
        setFilteredFiles(files);

        // Determine available filters
        const available = Object.keys(mimeTypeCategories).filter((category) => {
          const mimeTypes = mimeTypeCategories[category as MimeTypeCategory];
          return files.some((file) => mimeTypes.includes(file.mimeType));
        }) as (MimeTypeCategory | "All Files")[];
        setAvailableFilters(["All Files", ...available]);
      }
    };
    fetchFiles();
  }, [userEmail]);

  useEffect(() => {
    const filteredByCategory =
      filter === "All Files" || filter === "Others"
        ? files.filter((file) =>
            filter === "All Files"
              ? true
              : !Object.values(mimeTypeCategories)
                  .flat()
                  .includes(file.mimeType)
          )
        : files.filter((file) =>
            mimeTypeCategories[filter as MimeTypeCategory].includes(
              file.mimeType
            )
          );

    const filteredBySearch = filteredByCategory.filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredFiles(filteredBySearch);
  }, [filter, files, searchQuery]);

  const downloadAndDecryptFile = async (fileId: string, fileName: string) => {
    const authInstance = gapi.auth2.getAuthInstance();
    const token = authInstance.currentUser.get().getAuthResponse().access_token;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        method: "GET",
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      }
    );

    const fileBlob = await response.blob();
    const decryptedBlob = await decryptFile(fileBlob);

    const url = URL.createObjectURL(decryptedBlob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const getIconForMimeType = (mimeType: string) => {
    return iconMap[mimeType] || <FaRegFileLines />;
  };

  const [isOn, setIsOn] = useState(true);

  const handleToggle = () => {
    setIsOn(!isOn);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsOn(false);
      } else {
        setIsOn(true);
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files.length > 0) {
      setDroppedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const uploadDroppedFiles = async () => {
    if (droppedFiles.length === 0 || !userEmail) return;

    setLoading(true);

    try {
      const key = await getStoredKey();
      if (!key) {
        alert("No key found. Please enter a key or download one.");
        return;
      }

      const authInstance = gapi.auth2.getAuthInstance();
      const token = authInstance.currentUser
        .get()
        .getAuthResponse().access_token;

      for (const file of droppedFiles) {
        const encryptedBlob = await encryptFile(file);

        const metadata = {
          name: file.name,
          mimeType: file.type,
        };

        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", encryptedBlob);

        const response = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: new Headers({ Authorization: `Bearer ${token}` }),
            body: form,
          }
        );

        const data = await response.json();

        await addFile({
          id: data.id,
          name: file.name,
          mimeType: file.type,
          userEmail: userEmail,
          uploadedDate: new Date(),
        });
      }

      setDroppedFiles([]);
      window.location.reload();
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUpload = () => {
    setDroppedFiles([]);
  };

  return (
    <div className="md:p-6">
      {!localStorage.getItem("aes-gcm-key") && <KeyManagement />}
      <div className="flex flex-col justify-center gap-5 items-center">
        <Input
          type="text"
          placeholder=" Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-5 shadow-xl text-base bg-white rounded-full border w-full md:w-[60%]"
        />
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 mt-5">
        <EncryptedFileUploader />
        <div className="hidden md:flex justify-center flex-wrap gap-2 md:gap-4 items-center">
          {availableFilters.map((category) => (
            <Button
              key={category}
              onClick={() =>
                setFilter(category as MimeTypeCategory | "All Files")
              }
              variant={filter === category ? "default" : "outline"}
              className="text-sm shadow-xl p-3 rounded-full"
            >
              {category}
            </Button>
          ))}
        </div>
        <div className="hidden md:flex">
          <Button
            className="rounded-l-full shadow-xl py-3 px-3 md:py-5 md:pl-5 md:rounded-r-none"
            variant={isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlList />
          </Button>
          <Button
            className="rounded-r-full py-3 px-3 md:py-5 md:pr-5 md:rounded-l-none"
            variant={!isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlGrid />
          </Button>
        </div>
      </div>
      <form action="/file-upload" id="my-awesome-dropzone">
        <ScrollArea
          className={`flex flex-1 p-4 md:p-6 shadow-xl overflow-auto rounded-3xl mt-4`}
          style={{ height: "calc(100vh - 34vh)" }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {isOn ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Uploaded Date</TableHead>
                  <TableHead className="hidden md:flex">Type</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.length !== 0 &&
                  filteredFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>
                        {file.uploadedDate?.toLocaleString().split(",")[0]}
                      </TableCell>
                      <TableCell className="hidden md:flex">
                        {file.mimeType}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() =>
                            downloadAndDecryptFile(file.id, file.name)
                          }
                          variant="outline"
                        >
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="flex gap-3 justify-center md:justify-start content-start flex-wrap">
              {filteredFiles.length !== 0 &&
                filteredFiles.map((file) => (
                  <li key={file.id}>
                    <Button
                      className="h-36 w-36  md:h-40 md:w-40 bg-zinc-100/25 flex flex-col gap-2 shadow-xl overflow-hidden rounded-xl border-0"
                      onClick={() => downloadAndDecryptFile(file.id, file.name)}
                      variant="outline"
                    >
                      <p className="flex items-center h-[10%]">
                        {getIconForMimeType(file.mimeType)}
                        {file.name}
                      </p>
                      <div className="h-[80%] rounded-xl text-2xl bg-white w-full flex items-center justify-center">
                        {getIconForMimeType(file.mimeType)}
                      </div>
                      <p className="h-[10%]">
                        {file.uploadedDate?.toLocaleString().split(",")[0]}
                      </p>
                    </Button>
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
        </ScrollArea>
      </form>
    </div>
  );
};
