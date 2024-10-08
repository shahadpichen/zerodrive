import React, { useState, useEffect } from "react";
import {
  FileMeta,
  getAllFilesForUser,
  addFile,
  fetchAndStoreFileMetadata,
} from "../../utils/dexieDB";
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
import Spinner from "../ui/spinner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const FileList: React.FC = () => {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileMeta[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [filter, setFilter] = useState<MimeTypeCategory | "All Files">(
    "All Files"
  );
  const [availableFilters, setAvailableFilters] = useState<
    (MimeTypeCategory | "All Files")[]
  >([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null
  );

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
      fetchAndStoreFileMetadata();
      setIsLoadingFiles(true);
      if (userEmail) {
        const files = await getAllFilesForUser(userEmail);
        setFiles(files);
        setFilteredFiles(files);

        const available = Object.keys(mimeTypeCategories).filter((category) => {
          const mimeTypes = mimeTypeCategories[category as MimeTypeCategory];
          return files.some((file) => mimeTypes.includes(file.mimeType));
        }) as (MimeTypeCategory | "All Files")[];
        setAvailableFilters(["All Files", ...available]);
      }
      setIsLoadingFiles(false);
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
    setDownloadingFileId(fileId);
    try {
      const authInstance = gapi.auth2.getAuthInstance();
      const token = authInstance.currentUser
        .get()
        .getAuthResponse().access_token;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          method: "GET",
          headers: new Headers({ Authorization: `Bearer ${token}` }),
        }
      );

      if (!response.ok) {
        toast.error("Failed to download file:", {
          description: response.statusText,
        });
        setDownloadingFileId(null);
      }

      const fileBlob = await response.blob();

      let decryptedBlob;
      try {
        decryptedBlob = await decryptFile(fileBlob);
      } catch (decryptionError) {
        toast.error("Decryption failed: The key might be incorrect.");
        setDownloadingFileId(null);
      }

      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      toast.error("Error during file download or decryption:", {
        description: error.message,
      });
    } finally {
      setDownloadingFileId(null);
    }
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
        toast("No key found. Please enter a key or download one.");
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
    <div className="h-[90vh] overflow-hidden md:pl-6 md:pr-6">
      {!localStorage.getItem("aes-gcm-key") && <KeyManagement />}

      {/* Search Section */}

      <div className="flex flex-col h-fit">
        <div className="flex flex-col justify-center gap-5 items-center">
          <Input
            type="text"
            placeholder=" Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-5 text-base bg-white rounded-full border w-full md:w-[60%]"
          />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4 mt-5">
          <EncryptedFileUploader />

          {/* Section selection */}

          <div className="hidden md:flex justify-center flex-wrap gap-2 md:gap-4 items-center">
            {availableFilters.map((category) => (
              <Button
                key={category}
                onClick={() =>
                  setFilter(category as MimeTypeCategory | "All Files")
                }
                variant={filter === category ? "default" : "outline"}
                className="text-sm  p-3 rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Toggle */}

          <div className="hidden md:flex">
            <Button
              className="rounded-l-full  py-3 px-3 md:py-5 md:pl-5 md:rounded-r-none"
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
      </div>

      {/* File List */}

      <form
        className="h-full overflow-hidden"
        action="/file-upload"
        id="my-awesome-dropzone"
        onSubmit={(e) => {
          e.preventDefault();
          uploadDroppedFiles();
        }}
      >
        {isLoadingFiles ? (
          <div
            className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4"
            style={{ height: "calc(100vh - 34vh)" }}
          >
            <Spinner />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div
            className="flex justify-center items-center flex-1 p-4 md:p-6 rounded-xl mt-4 "
            style={{ height: "calc(100vh - 34vh)" }}
          >
            <p>No files available</p>
          </div>
        ) : (
          <ScrollArea
            className={`h-full p-4 overflow-y-auto w-full rounded-lg mt-4`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {isOn ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Uploaded Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.length !== 0 &&
                    filteredFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">
                          {file.name}
                        </TableCell>
                        <TableCell>
                          {file.uploadedDate?.toLocaleString().split(",")[0]}
                        </TableCell>
                        <TableCell>{file.mimeType}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() =>
                              downloadAndDecryptFile(file.id, file.name)
                            }
                            variant="outline"
                            disabled={downloadingFileId === file.id}
                          >
                            {downloadingFileId === file.id ? (
                              <Loader2 className="animate-spin size-4" />
                            ) : (
                              "Download"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <ul className="flex gap-3 flex-wrap">
                {filteredFiles.length !== 0 &&
                  filteredFiles.map((file) => (
                    <li key={file.id} className="relative">
                      <Button
                        className="h-36 w-36 md:h-40 md:w-40 bg-transparent flex flex-col gap-3 overflow-hidden rounded-md border-0 hover:bg-zinc-400/10 shadow-none"
                        onClick={() =>
                          downloadAndDecryptFile(file.id, file.name)
                        }
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
          </ScrollArea>
        )}
      </form>
    </div>
  );
};
