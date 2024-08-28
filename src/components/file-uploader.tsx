import { useState, useEffect } from "react";
import { gapi } from "gapi-script";
import { getStoredKey } from "../utils/cryptoUtils";
import { addFile } from "../utils/dexieDB";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { HiMiniPlus } from "react-icons/hi2";
import { Button } from "./ui/button";
import React from "react";

import { Input } from "./ui/input";

const encryptFile = async (file: File): Promise<Blob> => {
  const key = await getStoredKey();
  if (!key) throw new Error("No encryption key found.");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileArrayBuffer
  );

  const encryptedArray = new Uint8Array(
    iv.byteLength + encryptedBuffer.byteLength
  );
  encryptedArray.set(new Uint8Array(iv), 0);
  encryptedArray.set(new Uint8Array(encryptedBuffer), iv.byteLength);

  return new Blob([encryptedArray], { type: file.type });
};

export const EncryptedFileUploader: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
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
          setIsAuthenticated(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setIsAuthenticated);
        });
    };
    gapi.load("client:auth2", initClient);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0 || !isAuthenticated) return;

    setLoading(true); // Start loading

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

        console.log("File uploaded successfully:", data);

        // Store file metadata in Dexie.js
        await addFile({
          id: data.id,
          name: file.name,
          mimeType: file.type,
          userEmail: gapi.auth2
            .getAuthInstance()
            .currentUser.get()
            .getBasicProfile()
            .getEmail(),
        });
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setLoading(false); // End loading
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild className="fixed bottom-10 right-10">
        <Button variant="default" className="rounded-full flex py-7 gap-1">
          <HiMiniPlus className="text-2xl" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[465px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Files will be encrypted before being uploaded to Google Drive.
          </DialogDescription>
        </DialogHeader>
        <form
          action="/file-upload"
          className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg h-32 bg-gray-100 relative cursor-pointer hover:bg-gray-200"
          id="my-awesome-dropzone"
        >
          <Input
            type="file"
            onChange={handleFileChange}
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-center pointer-events-none">
            <p className="text-gray-500">
              Drag and drop files here, or{" "}
              <span className="text-blue-500 font-semibold underline mt-2">
                Browse
              </span>
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            onClick={uploadFiles}
            disabled={files.length === 0 || !isAuthenticated || loading}
          >
            {loading ? (
              <>
                Uploading Files...
                <svg
                  aria-hidden="true"
                  role="status"
                  className="ml-3 inline w-4 h-4 text-gray-200 animate-spin dark:text-gray-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="#1C64F2"
                  />
                </svg>
              </>
            ) : (
              "Upload Encrypted Files"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
