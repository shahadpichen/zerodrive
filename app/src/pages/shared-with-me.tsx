import React, { useState, useEffect, FC } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { FileIcon, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import {
  decryptSharedFile,
  hashEmail,
  arrayBufferToBase64,
  storeUserPublicKey,
  deleteFileFromStorage,
  fetchUserPublicKey,
  downloadEncryptedFile,
} from "../utils/fileSharing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getUserKeyPair } from "../utils/keyStorage";
import apiClient from "../utils/apiClient";
import { getStoredKey } from "../utils/cryptoUtils";
import { uploadAndSyncFile } from "../utils/fileOperations";
import { trackEvent, AnalyticsEvent, AnalyticsCategory } from "../utils/analyticsTracker";
import { getMnemonic } from "../utils/mnemonicManager";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";

interface SharedFile {
  id: string;
  fileId: string;
  driveFileId?: string;
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
    const getUserEmail = async () => {
      try {
        // Use authService to get email (more reliable than GAPI)
        const { getUserEmail: getEmail } = await import("../utils/authService");
        const email = await getEmail();

        if (email) {
          setUserEmail(email);
        } else {
          console.warn("User not authenticated");
          navigate("/");
        }
      } catch (error) {
        console.error("Error getting user email:", error);
        navigate("/");
      }
    };

    getUserEmail();
  }, [navigate]);

  // Check if user has generated keys and recover if needed
  useEffect(() => {
    const checkForKeys = async () => {
      if (!userEmail) return;

      setIsCheckingKeys(true);
      try {
        // Use centralized recovery utility
        const result = await recoverRsaKeysIfNeeded(userEmail, false);

        if (result.keysExisted || result.recovered) {
          setHasKeys(true);

          // Auto-repair: Ensure public key is synced to server
          if (result.keysExisted) {
            const hashedEmail = await hashEmail(userEmail);
            try {
              const serverKey = await fetchUserPublicKey(hashedEmail);
              if (!serverKey) {
                const mnemonic = getMnemonic();
                if (mnemonic) {
                  const localKeyPair = await getUserKeyPair(userEmail, mnemonic);
                  if (localKeyPair?.publicKeyJwk) {
                    await storeUserPublicKey(hashedEmail, localKeyPair.publicKeyJwk);
                    console.log('Public key synced to server');
                  }
                }
              }
            } catch (syncError) {
              console.error('Error syncing public key to server:', syncError);
            }
          }
        } else {
          setHasKeys(false);
        }
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
        const result = await apiClient.sharedFiles.getForUser(hashedEmail);
        const data = result.files;

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
      const result = await apiClient.sharedFiles.getForUser(hashedEmail);
      const data = result.files;

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

    // Check for primary key BEFORE allowing download
    const primaryKey = await getStoredKey();
    if (!primaryKey) {
      toast.error("Primary encryption key required", {
        description: "You must set up your encryption key before downloading shared files. Redirecting to Key Management...",
        duration: 5000,
      });
      setTimeout(() => {
        navigate("/key-management");
      }, 2000);
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

        // Attempt recovery using centralized utility
        const result = await recoverRsaKeysIfNeeded(userEmail, false);

        if (result.recovered || result.keysExisted) {
          setHasKeys(true);
          currentHasKeys = true;
          toast.loading(`Downloading ${file.originalFileName}...`, {
            id: downloadToastId,
          });
        } else {
          // Recovery failed or no backup found
          toast.error("Sharing keys not available", {
            description:
              "Please enable file sharing in the storage page to generate your sharing keys.",
            duration: 5000,
          });
          setIsDownloading(null);
          return;
        }
      }

      const mnemonic = getMnemonic();
      if (!mnemonic) {
        throw new Error("Mnemonic not available. Cannot decrypt RSA private key.");
      }

      const userKeyPair = await getUserKeyPair(userEmail, mnemonic);
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

      // Download encrypted file from MinIO using pre-signed URL
      encryptedFileBlob = await downloadEncryptedFile(file.fileId);
      if (!encryptedFileBlob) {
        throw new Error("Failed to retrieve file from storage.");
      }

      toast.loading("Decrypting file...", { id: downloadToastId });
      const decryptedData = await decryptSharedFile(
        encryptedFileBlob,
        finalEncryptedFileKey,
        userEmail,
        file.originalFileName,
        file.mimeType || "application/octet-stream",
        mnemonic
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

      // Track analytics for shared file access
      await trackEvent(
        AnalyticsEvent.SHARED_FILE_ACCESSED,
        AnalyticsCategory.SHARING
      );

      // ---- Add to user's own vault ----
      const saveToVaultToastId = toast.loading(
        `Attempting to save ${decryptedData.fileName} to your ZeroDrive vault...`
      );
      let savedToVaultSuccessfully = false;
      try {
        const primaryAesKeyForVault = await getStoredKey();
        if (!primaryAesKeyForVault) {
          toast.warning(
            "Primary key not found. Cannot save copy to your vault.",
            {
              id: saveToVaultToastId,
              description: "Please set up your main key in Key Management.",
              duration: 7000,
            }
          );
        } else {
          const decryptedFileObject = new File(
            [decryptedData.decryptedFile],
            decryptedData.fileName,
            { type: file.mimeType || "application/octet-stream" }
          );

          // Assuming userEmail is the email of the current user (recipient)
          const uploadResult = await uploadAndSyncFile(
            decryptedFileObject,
            userEmail
          );

          if (uploadResult) {
            toast.success(
              `${decryptedData.fileName} also saved to your ZeroDrive vault.`,
              { id: saveToVaultToastId }
            );
            savedToVaultSuccessfully = true;
          } else {
            toast.error(
              `Failed to save copy of ${decryptedData.fileName} to your vault.`,
              { id: saveToVaultToastId }
            );
          }
        }
      } catch (vaultError) {
        console.error("Error saving to vault:", vaultError);
        toast.error(`Error saving ${decryptedData.fileName} to your vault.`, {
          id: saveToVaultToastId,
          description:
            vaultError instanceof Error ? vaultError.message : "Unknown error.",
        });
      }
      // ---- End Add to user's own vault ----

      // If download and save to vault were successful, delete the original share
      if (savedToVaultSuccessfully) {
        const deleteShareToastId = toast.loading(
          `Removing original share for ${file.originalFileName}...`
        );
        try {
          // Delete from MinIO storage (note: auto-deletion after 7 days)
          await deleteFileFromStorage(file.encrypted_file_blob_id);

          // Delete from shared_files table via API
          await apiClient.sharedFiles.delete(file.id);

          toast.success(
            `Original share for ${file.originalFileName} removed successfully.`,
            {
              id: deleteShareToastId,
            }
          );
          handleRefresh(); // Refresh the list of shared files
        } catch (deleteError) {
          console.error("Error removing original share:", deleteError);
          toast.error(
            `Failed to remove original share for ${file.originalFileName}.`,
            {
              id: deleteShareToastId,
              description:
                deleteError instanceof Error
                  ? deleteError.message
                  : "Please check console or try manually if needed.",
            }
          );
        }
      }
    } catch (error: any) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shared With Me</h1>
          <p className="text-muted-foreground mt-1">
            View and access files that have been shared with you
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
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
              primary encryption key is set up. Successfully downloaded files
              are also automatically saved to your personal ZeroDrive vault if
              your primary key is configured.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedWithMePage;
