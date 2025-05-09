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
  UserKeyPair,
  storeUserPublicKey,
} from "../utils/fileSharing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  userHasStoredKeys,
  getUserKeyPair,
  storeUserKeyPair,
} from "../utils/keyStorage";
import supabase from "../utils/supabaseClient";
import { downloadEncryptedFile } from "../utils/fileSharing";
import { getStoredKey } from "../utils/cryptoUtils";
import { downloadEncryptedRsaKeyFromDrive } from "../utils/gdriveKeyStorage";
import { decryptRsaPrivateKeyWithAesKey } from "../utils/rsaKeyManager";

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
        const hasStoredKeysInDb = await userHasStoredKeys(userEmail);
        setHasKeys(hasStoredKeysInDb);
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
            if (typeof rawKey === "string" && rawKey.startsWith("\\x")) {
              const hex = rawKey.substring(2);
              const tempBytes = new Uint8Array(hex.length / 2);
              for (let i = 0; i < hex.length; i += 2) {
                tempBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
              }
              finalEncryptedFileKey = arrayBufferToBase64(tempBytes.buffer);
            } else if (typeof rawKey === "string") {
              finalEncryptedFileKey = rawKey;
            } else if (
              rawKey &&
              typeof rawKey === "object" &&
              rawKey.buffer instanceof ArrayBuffer
            ) {
              finalEncryptedFileKey = arrayBufferToBase64(rawKey);
            } else {
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
          if (typeof rawKey === "string" && rawKey.startsWith("\\x")) {
            const hex = rawKey.substring(2);
            const tempBytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
              tempBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
            }
            finalEncryptedFileKey = arrayBufferToBase64(tempBytes.buffer);
          } else if (typeof rawKey === "string") {
            finalEncryptedFileKey = rawKey;
          } else if (
            rawKey &&
            typeof rawKey === "object" &&
            rawKey.buffer instanceof ArrayBuffer
          ) {
            finalEncryptedFileKey = arrayBufferToBase64(rawKey);
          } else {
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

    setIsDownloading(file.id);
    const downloadToastId = toast.loading(
      `Downloading ${file.originalFileName}...`
    );

    let encryptedFileBlob: Blob | undefined;
    let currentHasKeys = hasKeys;

    try {
      if (!currentHasKeys) {
        toast.dismiss(downloadToastId);
        const recoveryToastId = toast.loading(
          "Sharing keys not found locally. Checking primary key for backup recovery..."
        );
        const primaryAesKey = await getStoredKey();

        if (!primaryAesKey) {
          toast.error("Primary encryption key missing.", {
            id: recoveryToastId,
            description:
              "Redirecting to Key Management to set up or restore your primary key.",
            duration: 5000,
          });
          navigate("/key-management");
          setIsDownloading(null);
          return;
        }

        toast.loading(
          "Attempting to recover sharing keys from Google Drive backup...",
          { id: recoveryToastId }
        );
        const backupBlob = await downloadEncryptedRsaKeyFromDrive();

        if (backupBlob) {
          try {
            const privateKeyJwk = await decryptRsaPrivateKeyWithAesKey(
              backupBlob,
              primaryAesKey
            );
            const publicKeyJwk: JsonWebKey = {
              kty: privateKeyJwk.kty,
              n: privateKeyJwk.n,
              e: privateKeyJwk.e,
              alg: privateKeyJwk.alg
                ? privateKeyJwk.alg.replace("PS", "RS")
                : "RSA-OAEP-256",
              key_ops: ["encrypt"],
              ext: true,
            };
            if (!publicKeyJwk.n || !publicKeyJwk.e || !publicKeyJwk.kty) {
              throw new Error(
                "Failed to reconstruct public key from private key backup."
              );
            }
            if (!privateKeyJwk.key_ops) {
              privateKeyJwk.key_ops = ["decrypt"];
            }
            const recoveredKeyPair: UserKeyPair = {
              publicKeyJwk,
              privateKeyJwk,
            };

            await storeUserKeyPair(userEmail, recoveredKeyPair);
            const hashedEmailForSupabase = await hashEmail(userEmail);
            await storeUserPublicKey(
              hashedEmailForSupabase,
              recoveredKeyPair.publicKeyJwk
            );

            setHasKeys(true);
            currentHasKeys = true;
            toast.success("Sharing keys recovered from backup and loaded.", {
              id: recoveryToastId,
            });
            toast.loading(`Downloading ${file.originalFileName}...`, {
              id: downloadToastId,
            });
          } catch (decryptionError) {
            toast.error("Failed to decrypt sharing key backup.", {
              id: recoveryToastId,
              description:
                decryptionError instanceof Error
                  ? decryptionError.message
                  : "Primary key might be incorrect or backup corrupted.",
            });
            setIsDownloading(null);
            return;
          }
        } else {
          toast.error("No sharing key backup found on Google Drive.", {
            id: recoveryToastId,
            description:
              "Please generate sharing keys on the Share Files page if this is your first time or a new device.",
          });
          setIsDownloading(null);
          return;
        }
      }

      const userKeyPair = await getUserKeyPair(userEmail);
      if (!userKeyPair || !userKeyPair.privateKeyJwk) {
        throw new Error(
          "Private key JWK not found even after checks/recovery. Please ensure keys are generated and retrieved correctly."
        );
      }

      let finalEncryptedFileKey = file.encryptedFileKey;
      if (finalEncryptedFileKey.startsWith("\\x")) {
        const hex = finalEncryptedFileKey.substring(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        finalEncryptedFileKey = arrayBufferToBase64(bytes.buffer);
      }

      const s3Object = await downloadEncryptedFile(file.encrypted_file_blob_id);
      if (!s3Object || !s3Object.transformToByteArray) {
        throw new Error(
          "Failed to retrieve file from storage or S3 object is invalid."
        );
      }
      const fileBytes = await s3Object.transformToByteArray();
      encryptedFileBlob = new Blob([fileBytes], {
        type: file.mimeType || "application/octet-stream",
      });

      toast.loading("Decrypting file...", { id: downloadToastId });
      const decryptedData = await decryptSharedFile(
        encryptedFileBlob,
        finalEncryptedFileKey,
        userEmail,
        file.originalFileName,
        file.mimeType
      );

      const downloadUrl = URL.createObjectURL(decryptedData.decryptedFile);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = decryptedData.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      toast.success(`Successfully downloaded ${decryptedData.fileName}`, {
        id: downloadToastId,
      });
    } catch (error) {
      console.error("Error downloading or decrypting file:", error);
      toast.error("Download or Decryption Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
        id: downloadToastId,
      });

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
          rawDownloadLink.download = `ENCRYPTED_${file.originalFileName}.bin`;
          document.body.appendChild(rawDownloadLink);
          rawDownloadLink.click();
          document.body.removeChild(rawDownloadLink);
          URL.revokeObjectURL(rawDownloadUrl);
          toast.success(
            `Raw encrypted file ENCRYPTED_${file.originalFileName}.bin downloaded.`,
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
                Sharing Key Setup Incomplete or Not Found Locally
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                To download and decrypt shared files, your sharing keys are
                required. If you've used ZeroDrive on another device, ensure
                your primary key is set up here (via Key Management) to attempt
                recovery of your sharing keys from Google Drive backup.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
                If this is your first time or a new setup for this email (
                {userEmail}), you might need to generate sharing keys first.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate("/key-management")}
                  className="flex-1"
                >
                  Go to Key Management (for primary key)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate("/share")}
                  className="flex-1"
                >
                  Go to Share Files (to generate sharing keys)
                </Button>
              </div>
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
                      {file.fileSize
                        ? (file.fileSize / 1024).toFixed(1) + " KB"
                        : "N/A"}
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
                          "Processing..."
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
              Files are downloaded and decrypted securely in your browser using
              your private sharing key. If not found locally, the app will
              attempt to recover it from your Google Drive backup, provided your
              primary encryption key is set up.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedWithMePage;
