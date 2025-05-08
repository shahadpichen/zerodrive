import React, { useState, useEffect, FC } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeft, FileIcon, Download, RefreshCw } from "lucide-react";
import { gapi } from "gapi-script";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import {
  findFilesSharedWithRecipient,
  decryptSharedFile,
  hashEmail,
  arrayBufferToBase64,
} from "../utils/fileSharing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { userHasStoredKeys } from "../utils/keyStorage";
import supabase from "../utils/supabaseClient";
import { downloadEncryptedFile } from "../utils/fileSharing";

interface SharedFile {
  id: string;
  fileId?: string;
  driveFileId?: string;
  encrypted_file_blob_id: string;
  originalFileName: string;
  sender: string;
  createdAt: string;
  encryptedFileKey: string;
  fileSize?: number;
  mimeType?: string;
}

const SharedWithMePage: FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [hasKeys, setHasKeys] = useState<boolean>(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState<boolean>(true);

  // Get the user's email from Google auth
  useEffect(() => {
    const getUserEmail = () => {
      try {
        const authInstance = gapi.auth2?.getAuthInstance();
        if (authInstance && authInstance.isSignedIn.get()) {
          const profile = authInstance.currentUser.get().getBasicProfile();
          if (profile) {
            const email = profile.getEmail();
            setUserEmail(email);
          } else {
            console.warn("GAPI signed in but profile is null.");
            navigate("/");
          }
        } else {
          console.warn("GAPI not signed in or auth instance unavailable.");
          navigate("/");
        }
      } catch (error) {
        console.error("Error getting user profile:", error);
        navigate("/");
      }
    };

    getUserEmail();
  }, [navigate]);

  // Check if user has generated keys
  useEffect(() => {
    const checkForKeys = async () => {
      if (!userEmail) return;

      setIsCheckingKeys(true);
      try {
        // Check if user has keys stored in IndexedDB
        const hasStoredKeys = await userHasStoredKeys(userEmail);
        setHasKeys(hasStoredKeys);
      } catch (error) {
        console.error("Error checking for keys:", error);
        setHasKeys(false);
      } finally {
        setIsCheckingKeys(false);
      }
    };

    if (userEmail) {
      checkForKeys();
    }
  }, [userEmail]);

  // Load shared files
  useEffect(() => {
    const loadSharedFiles = async () => {
      if (!userEmail) return;

      setIsLoading(true);
      try {
        const hashedEmail = await hashEmail(userEmail);
        const { data, error } = await supabase
          .from("shared_files")
          .select("*")
          .eq("recipient_email_hash", hashedEmail);

        if (error) throw error;

        if (data) {
          const mappedFiles: SharedFile[] = data.map((dbRow: any) => {
            let finalEncryptedFileKey = "";
            const rawKey = dbRow.encrypted_file_key;
            console.log(
              `[RECIPIENT-DEBUG] Raw 'encrypted_file_key' from Supabase for ID ${dbRow.id}:`,
              rawKey,
              `(type: ${typeof rawKey})`
            );
            if (typeof rawKey === "string" && rawKey.startsWith("\\x")) {
              const hex = rawKey.substring(2);
              const tempBytes = new Uint8Array(hex.length / 2);
              for (let i = 0; i < hex.length; i += 2) {
                tempBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
              }
              finalEncryptedFileKey = arrayBufferToBase64(tempBytes.buffer);
              console.log(
                `[RECIPIENT-DEBUG] Converted hex BYTEA to base64: "${finalEncryptedFileKey}"`
              );
            } else if (typeof rawKey === "string") {
              finalEncryptedFileKey = rawKey;
              console.log(
                `[RECIPIENT-DEBUG] Assuming rawKey string is already base64: "${finalEncryptedFileKey}"`
              );
            } else if (
              rawKey &&
              typeof rawKey === "object" &&
              rawKey.buffer instanceof ArrayBuffer
            ) {
              finalEncryptedFileKey = arrayBufferToBase64(rawKey);
              console.log(
                `[RECIPIENT-DEBUG] Converted direct ArrayBuffer to base64: "${finalEncryptedFileKey}"`
              );
            } else {
              console.warn(
                "[RECIPIENT-DEBUG] Unexpected format for encrypted_file_key from DB:",
                rawKey
              );
            }
            return {
              id: dbRow.id,
              fileId: dbRow.file_id,
              driveFileId: dbRow.drive_file_id,
              encrypted_file_blob_id: dbRow.encrypted_file_blob_id,
              originalFileName: dbRow.file_name,
              sender: dbRow.sender_hashed_email,
              createdAt: new Date(dbRow.created_at).toLocaleString(),
              encryptedFileKey: finalEncryptedFileKey,
              fileSize: dbRow.file_size,
              mimeType: dbRow.file_mime_type,
            };
          });
          setSharedFiles(mappedFiles);
        }
      } catch (error) {
        console.error("Error loading shared files:", error);
        toast.error("Failed to load shared files", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (userEmail) loadSharedFiles();
  }, [userEmail]);

  const handleRefresh = async () => {
    if (!userEmail) return;

    setIsLoading(true);
    toast.loading("Refreshing shared files...");

    try {
      const hashedEmail = await hashEmail(userEmail);
      const { data, error } = await supabase
        .from("shared_files")
        .select("*")
        .eq("recipient_email_hash", hashedEmail);

      if (error) throw error;

      if (data) {
        const mappedFiles: SharedFile[] = data.map((dbRow: any) => {
          let finalEncryptedFileKey = "";
          const rawKey = dbRow.encrypted_file_key;
          console.log(
            `[RECIPIENT-DEBUG] (Refresh) Raw 'encrypted_file_key' from Supabase for ID ${dbRow.id}:`,
            rawKey,
            `(type: ${typeof rawKey})`
          );
          if (typeof rawKey === "string" && rawKey.startsWith("\\x")) {
            const hex = rawKey.substring(2);
            const tempBytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
              tempBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
            }
            finalEncryptedFileKey = arrayBufferToBase64(tempBytes.buffer);
            console.log(
              `[RECIPIENT-DEBUG] (Refresh) Converted hex BYTEA to base64: "${finalEncryptedFileKey}"`
            );
          } else if (typeof rawKey === "string") {
            finalEncryptedFileKey = rawKey;
            console.log(
              `[RECIPIENT-DEBUG] (Refresh) Assuming rawKey string is already base64: "${finalEncryptedFileKey}"`
            );
          } else if (
            rawKey &&
            typeof rawKey === "object" &&
            rawKey.buffer instanceof ArrayBuffer
          ) {
            finalEncryptedFileKey = arrayBufferToBase64(rawKey);
            console.log(
              `[RECIPIENT-DEBUG] (Refresh) Converted direct ArrayBuffer to base64: "${finalEncryptedFileKey}"`
            );
          } else {
            console.warn(
              "[RECIPIENT-DEBUG] (Refresh) Unexpected format for encrypted_file_key from DB:",
              rawKey
            );
          }
          return {
            id: dbRow.id,
            fileId: dbRow.file_id,
            driveFileId: dbRow.drive_file_id,
            encrypted_file_blob_id: dbRow.encrypted_file_blob_id,
            originalFileName: dbRow.file_name,
            sender: dbRow.sender_hashed_email,
            createdAt: new Date(dbRow.created_at).toLocaleString(),
            encryptedFileKey: finalEncryptedFileKey,
            fileSize: dbRow.file_size,
            mimeType: dbRow.file_mime_type,
          };
        });
        setSharedFiles(mappedFiles);
      }

      toast.success("Shared files refreshed");
    } catch (error) {
      console.error("Error refreshing shared files:", error);
      toast.error("Failed to refresh shared files", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!userEmail) {
      toast.error("User email not available");
      return;
    }

    if (!hasKeys) {
      toast.error("You need to generate your keys first", {
        description:
          "Go to the Share Files page to generate your encryption keys.",
      });
      return;
    }

    setIsDownloading(file.id);
    const downloadToastId = toast.loading(
      `Downloading ${file.originalFileName}...`
    );

    let encryptedFileBlob: Blob | undefined;

    try {
      // Debug the encryptedFileKey
      console.log("Raw encryptedFileKey:", file.encryptedFileKey);
      // Check if it's in BYTEA format (Postgres outputs as \x...)
      if (file.encryptedFileKey.startsWith("\\x")) {
        // Convert Postgres bytea hex format to base64
        const hex = file.encryptedFileKey.substring(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        file.encryptedFileKey = arrayBufferToBase64(bytes.buffer);
        console.log("Converted encryptedFileKey:", file.encryptedFileKey);
      }

      // Try a more direct approach with AWS SDK v3
      const response = await downloadEncryptedFile(file.encrypted_file_blob_id);

      // Try alternative approaches to get file content
      if (response.transformToByteArray) {
        // Use SDK's built-in method if available
        const bytes = await response.transformToByteArray();
        encryptedFileBlob = new Blob([bytes], {
          type: "application/octet-stream",
        });
      } else {
        // Fall back to checking for file_content in database
        const { data, error } = await supabase
          .from("shared_files")
          .select("file_content, share_id")
          .eq("id", file.id)
          .single();

        if (error || !data?.file_content) {
          throw new Error("Failed to retrieve file content");
        }

        // Safer base64 handling
        try {
          let base64Content = data.file_content;

          // If it contains the data URL prefix, extract just the base64 part
          if (base64Content.includes("base64,")) {
            base64Content = base64Content.split("base64,")[1];
          }

          // Create blob directly from base64
          const response = await fetch(
            `data:application/octet-stream;base64,${base64Content}`
          );
          encryptedFileBlob = await response.blob();
        } catch (e) {
          console.error("Base64 decode error:", e);
          throw new Error("Failed to decode file content");
        }
      }

      // Decrypt the file
      toast.loading("Decrypting file...", { id: downloadToastId });
      const decryptedFile = await decryptSharedFile(
        encryptedFileBlob,
        file.encryptedFileKey,
        userEmail,
        file.originalFileName,
        file.mimeType
      );

      // Create a download link
      const downloadUrl = URL.createObjectURL(decryptedFile.decryptedFile);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = decryptedFile.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success(`Successfully downloaded ${decryptedFile.fileName}`, {
        id: downloadToastId,
      });
    } catch (error) {
      console.error("Error downloading or decrypting file:", error);
      toast.error("Failed to decrypt file", {
        description: error instanceof Error ? error.message : "Unknown error",
        id: downloadToastId,
      });

      // Attempt to download the raw encrypted file for debugging
      if (
        encryptedFileBlob &&
        (error.name === "OperationError" ||
          (error instanceof Error &&
            error.message.includes("Decryption failed")))
      ) {
        try {
          toast.info(
            "Decryption failed. Offering raw encrypted file for download.",
            { id: downloadToastId }
          );
          const rawDownloadUrl = URL.createObjectURL(encryptedFileBlob);
          const rawDownloadLink = document.createElement("a");
          rawDownloadLink.href = rawDownloadUrl;
          rawDownloadLink.download = `ENCRYPTED_${file.originalFileName}.bin`; // Add a prefix
          document.body.appendChild(rawDownloadLink);
          rawDownloadLink.click();
          document.body.removeChild(rawDownloadLink);
          URL.revokeObjectURL(rawDownloadUrl);
          toast.success(
            `Raw encrypted file ENCRYPTED_${file.originalFileName}.bin downloaded for inspection.`,
            { id: downloadToastId }
          );
        } catch (rawDownloadError) {
          console.error(
            "Error downloading raw encrypted file:",
            rawDownloadError
          );
          toast.error("Could not download raw encrypted file.", {
            id: downloadToastId,
          });
        }
      }
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background py-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Files Shared With Me</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
                aria-label="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/storage")}
                aria-label="Back to Storage"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            View and access files that have been shared with you
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isCheckingKeys ? (
            <div className="flex justify-center py-4">
              <p className="text-sm text-muted-foreground">
                Checking key status...
              </p>
            </div>
          ) : !hasKeys ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800 mb-4">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Key Setup Required
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
                Before you can decrypt shared files, you need to generate your
                encryption keys. This is a one-time setup for your account (
                {userEmail}).
              </p>
              <Button
                size="sm"
                onClick={() => navigate("/share")}
                className="w-full"
              >
                Go to Key Setup
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-sm text-muted-foreground">
                Loading shared files...
              </p>
            </div>
          ) : sharedFiles.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No files have been shared with you yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Shared On</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileIcon className="h-4 w-4" />
                      {file.originalFileName}
                    </TableCell>
                    <TableCell>{file.createdAt}</TableCell>
                    <TableCell>
                      {(file.fileSize / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile(file)}
                        disabled={isDownloading === file.id}
                        className="flex items-center gap-1"
                      >
                        {isDownloading === file.id ? (
                          "Downloading..."
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Download
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Separator />

          <div className="bg-muted p-4 rounded-md">
            <h3 className="text-sm font-medium mb-2">
              About Secure File Downloads
            </h3>
            <p className="text-xs text-muted-foreground">
              Files are downloaded directly from Google Drive and decrypted
              securely in your browser using your private key. Your keys are
              stored locally and associated with your email address, providing
              an additional layer of security.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedWithMePage;
