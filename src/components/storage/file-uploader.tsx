import React, { useState, useEffect } from "react";
import { gapi } from "gapi-script";
import { getStoredKey } from "../../utils/cryptoUtils";
import { addFile } from "../../utils/dexieDB";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import Dropzone from "./dropzone";
import UploadButton from "./upload-button";
import { Button } from "../ui/button";
import { HiMiniPlus } from "react-icons/hi2";
import { encryptFile } from "../../utils/encryptFile";

export const EncryptedFileUploader: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [fileNames, setFileNames] = useState<string[]>([]);

  useEffect(() => {
    const initClient = () => {
      gapi.client
        .init({
          clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          setIsAuthenticated(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setIsAuthenticated);
        });
    };
    gapi.load("client:auth2", initClient);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setFiles(Array.from(files));
      setFileNames(Array.from(files).map((file) => file.name));
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0 || !isAuthenticated) return;

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

      for (const file of files) {
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
          userEmail: gapi.auth2
            .getAuthInstance()
            .currentUser.get()
            .getBasicProfile()
            .getEmail(),
          uploadedDate: new Date(),
        });
      }

      window.location.reload();
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="flex gap-1 shadow-xl rounded-full py-6"
        >
          Add File <HiMiniPlus className="text-xl" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[465px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Files will be encrypted before being uploaded to Google Drive.
          </DialogDescription>
        </DialogHeader>
        <Dropzone fileNames={fileNames} onFileChange={handleFileChange} />
        <DialogFooter>
          <UploadButton
            onClick={uploadFiles}
            isLoading={loading}
            isDisabled={files.length === 0 || !isAuthenticated}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
