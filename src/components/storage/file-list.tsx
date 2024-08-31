import { useState, useEffect } from "react";
import { FileMeta, getAllFilesForUser } from "../../utils/dexieDB";
import { gapi } from "gapi-script";
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
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import React from "react";
import { KeyManagement } from "./download-key";
import { EncryptedFileUploader } from "./file-uploader";
import { SlGrid, SlList } from "react-icons/sl";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type MimeTypeCategory =
  | "Images"
  | "PDFs"
  | "Text"
  | "Archives"
  | "Videos"
  | "Audio"
  | "Spreadsheets"
  | "Presentations"
  | "Others";

const iconMap: Record<string, JSX.Element> = {
  "image/jpeg": <FaImages />,
  "image/png": <FaImages />,
  "image/svg+xml": <FaImages />,
  "text/plain": <FaRegFileLines />,
  "application/pdf": <FaRegFilePdf />,
  "text/html": <FaRegFileCode />,
  "application/zip": <FaRegFileZipper />,
  "video/mp4": <FaRegFileVideo />,
  "audio/mpeg": <FaRegFileAudio />,
  "audio/wav": <FaRegFileAudio />,
  "application/vnd.ms-excel": <FaRegFileExcel />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
    <FaRegFileExcel />
  ),
  "application/vnd.ms-powerpoint": <FaRegFilePowerpoint />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
    <FaRegFilePowerpoint />
  ),
};

const mimeTypeCategories: Record<MimeTypeCategory, string[]> = {
  Images: ["image/jpeg", "image/png", "image/svg+xml"],
  PDFs: ["application/pdf"],
  Text: ["text/plain", "text/html"],
  Archives: ["application/zip"],
  Videos: ["video/mp4"],
  Audio: ["audio/mpeg", "audio/wav"],
  Spreadsheets: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  Presentations: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  Others: [""],
};

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

  // const { theme } = useTheme();

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

  return (
    <div className="p-6">
      {!localStorage.getItem("aes-gcm-key") && <KeyManagement />}
      <div className="flex flex-col justify-center gap-5 items-center">
        <Input
          type="text"
          placeholder=" Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-5 shadow-xl text-base bg-white rounded-full border w-[60%]"
        />
      </div>
      <div className="flex justify-between mx-20 my-5">
        <EncryptedFileUploader />
        <div className="flex justify-between gap-4 items-center">
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
        <div className="flex">
          <Button
            className="rounded-l-full shadow-xl py-5 pl-5 rounded-r-none"
            variant={isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlList />
          </Button>
          <Button
            className="rounded-r-full py-5 pr-5 rounded-l-none"
            variant={!isOn ? "default" : "outline"}
            onClick={handleToggle}
          >
            <SlGrid />
          </Button>
        </div>
      </div>
      <ScrollArea
        className={`flex flex-1 p-6 shadow-xl overflow-scroll rounded-3xl`}
        style={{ height: "calc(100vh - 34vh)" }}
      >
        {isOn ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Uploaded Date</TableHead> <TableHead>Type</TableHead>
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
                    <TableCell>{file.mimeType}</TableCell>
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
          <ul className="flex gap-3 content-start flex-wrap">
            {filteredFiles.length !== 0 &&
              filteredFiles.map((file) => (
                <li key={file.id}>
                  <Button
                    className="p-6 flex gap-2 shadow-xl border-0"
                    onClick={() => downloadAndDecryptFile(file.id, file.name)}
                    variant="outline"
                  >
                    {getIconForMimeType(file.mimeType)}
                    {file.name}
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};

const decryptFile = async (fileBlob: Blob): Promise<Blob> => {
  const keyJWK = JSON.parse(localStorage.getItem("aes-gcm-key") || "{}");
  const key = await crypto.subtle.importKey(
    "jwk",
    keyJWK,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  const fileArrayBuffer = await fileBlob.arrayBuffer();
  const iv = new Uint8Array(12);
  iv.set(new Uint8Array(fileArrayBuffer.slice(0, 12)));
  const encryptedData = new Uint8Array(fileArrayBuffer.slice(12));

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedData
  );

  return new Blob([decryptedBuffer]);
};
