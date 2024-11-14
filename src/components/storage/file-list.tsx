import React, { useState, useEffect } from "react";
import {
  FileMeta,
  getAllFilesForUser,
  addFile,
  fetchAndStoreFileMetadata,
} from "../../utils/dexieDB";
import { gapi } from "gapi-script";

import { KeyManagement } from "./download-key";

import { decryptFile } from "../../utils/decryptFile";
import { FaRegFileLines } from "react-icons/fa6";
import {
  MimeTypeCategory,
  iconMap,
  mimeTypeCategories,
} from "../../lib/mime-types";
import { encryptFile } from "../../utils/encryptFile";
import { getStoredKey } from "../../utils/cryptoUtils";
import { toast } from "sonner";
import { FileListHeader } from "./file-list/header";
import { FilterButtons } from "./file-list/filter-buttons";
import { FileListContent } from "./file-list/content";

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
    <div className="h-[90vh] px-6 py-10 w-[80vw]">
      {!localStorage.getItem("aes-gcm-key") && <KeyManagement />}
      <div className="flex flex-col h-[15vh] mb-2">
        <FileListHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isOn={isOn}
          setIsOn={setIsOn}
        />

        <FilterButtons
          filter={filter}
          setFilter={setFilter}
          availableFilters={availableFilters}
        />
      </div>

      <form
        className="h-fit"
        action="/file-upload"
        id="my-awesome-dropzone"
        onSubmit={(e) => {
          e.preventDefault();
          uploadDroppedFiles();
        }}
      >
        <FileListContent
          isLoadingFiles={isLoadingFiles}
          filteredFiles={filteredFiles}
          isOn={isOn}
          downloadAndDecryptFile={downloadAndDecryptFile}
          downloadingFileId={downloadingFileId}
          droppedFiles={droppedFiles}
          loading={loading}
          handleDrop={handleDrop}
          handleDragOver={handleDragOver}
          uploadDroppedFiles={uploadDroppedFiles}
          handleCancelUpload={handleCancelUpload}
        />
      </form>
    </div>
  );
};
