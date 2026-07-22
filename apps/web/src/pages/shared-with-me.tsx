import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Download,
  HardDrive,
  Inbox,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { VaultAccessRequired } from "../components/vault-access-required";
import { getFileIconPath } from "../lib/mime-types";
import {
  arrayBufferToBase64,
  decryptSharedFile,
  decryptSharedMetadata,
  downloadEncryptedFile,
} from "../utils/fileSharing";
import { getUserKeyPair } from "../utils/keyStorage";
import apiClient from "../utils/apiClient";
import { getStoredKey } from "../utils/cryptoUtils";
import { fetchAndStoreFileMetadata } from "../utils/dexieDB";
import { uploadAndSyncFile } from "../utils/fileOperations";
import { getMnemonic } from "../utils/mnemonicManager";
import { downloadEncryptedRsaKeyFromDrive } from "../utils/gdriveKeyStorage";
import { decryptRsaPrivateKeyWithAesKey } from "../utils/rsaKeyManager";
import { readRecipientKeyVersion } from "@zerodrive/crypto";
import { recoverRsaKeyVersion } from "../utils/rsaKeyRecovery";
import { useOptionalVaultData } from "../contexts/vault-data-context";
import { rememberVaultMetadataStatus } from "../utils/vaultMetadataWriteGuard";
import { toast } from "sonner";

type KeyState =
  | "checking"
  | "ready"
  | "primary-missing"
  | "sharing-missing";

type FileAction = "download" | "save";
type ActionStage = "downloading" | "decrypting" | "saving";

interface SharedFile {
  id: string;
  name: string;
  createdAt: Date;
  expiresAt: Date | null;
  encryptedFileKey: string;
  encryptedMetadata: string | null;
  metadataDecrypted: boolean;
  fileSize: number | null;
  mimeType: string;
  message?: string;
  recipientKeyVersion: number | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Unknown size";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function normalizeEncryptedKey(rawKey: unknown): string {
  if (typeof rawKey === "string") return rawKey;
  if (rawKey instanceof ArrayBuffer) return arrayBufferToBase64(rawKey);
  if (ArrayBuffer.isView(rawKey)) {
    return arrayBufferToBase64(
      rawKey.buffer.slice(
        rawKey.byteOffset,
        rawKey.byteOffset + rawKey.byteLength,
      ) as ArrayBuffer,
    );
  }
  return "";
}

function mapSharedFile(row: any): SharedFile {
  return {
    id: row.id,
    name: row.file_name || "Encrypted file",
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    encryptedFileKey: normalizeEncryptedKey(row.encrypted_file_key),
    recipientKeyVersion:
      typeof row.encrypted_file_key === "string"
        ? readRecipientKeyVersion(row.encrypted_file_key)
        : null,
    encryptedMetadata: row.encrypted_metadata || null,
    metadataDecrypted: !row.encrypted_metadata,
    fileSize:
      typeof row.file_size === "number"
        ? row.file_size
        : row.file_size
          ? Number(row.file_size)
          : null,
    mimeType: row.mime_type || row.file_mime_type || "application/octet-stream",
  };
}

const SharedWithMePage: React.FC = () => {
  const navigate = useNavigate();
  const vaultData = useOptionalVaultData();
  const [userEmail, setUserEmail] = useState("");
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharingPrivateKey, setSharingPrivateKey] = useState<JsonWebKey | null>(
    null,
  );
  const [keyState, setKeyState] = useState<KeyState>("checking");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedFileIds, setSavedFileIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<{
    fileId: string;
    action: FileAction;
    stage: ActionStage;
  } | null>(null);

  const loadSharedFiles = useCallback(async (showConfirmation = false) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const result = await apiClient.sharedFiles.getForUser();
      setSharedFiles((result.files || []).map(mapSharedFile));
      if (showConfirmation) toast.success("Inbox refreshed");
    } catch (error) {
      console.error("[SharedWithMe] Failed to load files:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Your shared files could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sharingPrivateKey) return;
    const pending = sharedFiles.filter(
      (file) => file.encryptedMetadata && !file.metadataDecrypted,
    );
    if (pending.length === 0) return;

    let active = true;
    void Promise.all(
      pending.map(async (file) => {
        try {
          const mnemonic = getMnemonic();
          let versionedKeyPair =
            file.recipientKeyVersion && mnemonic
              ? await getUserKeyPair(
                  userEmail,
                  mnemonic,
                  file.recipientKeyVersion,
                )
              : null;
          if (!versionedKeyPair && file.recipientKeyVersion && mnemonic) {
            versionedKeyPair = await recoverRsaKeyVersion(
              userEmail,
              file.recipientKeyVersion,
              mnemonic,
            );
          }
          const metadata = await decryptSharedMetadata(
            file.encryptedMetadata!,
            file.encryptedFileKey,
            versionedKeyPair?.privateKeyJwk || sharingPrivateKey,
          );
          return {
            id: file.id,
            name: metadata.name,
            mimeType: metadata.mimeType,
            message: metadata.message,
          };
        } catch {
          return {
            id: file.id,
            name: "Encrypted metadata unavailable",
            mimeType: "application/octet-stream",
          };
        }
      }),
    ).then((decrypted) => {
      if (!active) return;
      const byId = new Map(
        decrypted.map((metadata) => [metadata.id, metadata]),
      );
      setSharedFiles((current) =>
        current.map((file) => {
          const metadata = byId.get(file.id);
          return metadata
            ? { ...file, ...metadata, metadataDecrypted: true }
            : file;
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [sharedFiles, sharingPrivateKey]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const { getUserEmail } = await import("../utils/authService");
        const email = await getUserEmail();
        if (!email) {
          navigate("/");
          return;
        }
        if (!active) return;
        setUserEmail(email);

        const primaryKey = await getStoredKey();
        if (!active) return;

        if (!primaryKey) {
          setKeyState("primary-missing");
        } else {
          try {
            const encryptedBackup = await downloadEncryptedRsaKeyFromDrive();
            const privateKey = await decryptRsaPrivateKeyWithAesKey(
              encryptedBackup,
              primaryKey,
            );
            if (!active) return;
            setSharingPrivateKey(privateKey);
            setKeyState("ready");
          } catch (backupError) {
            console.warn(
              "[SharedWithMe] AES sharing-key recovery unavailable:",
              backupError,
            );

            const mnemonic = getMnemonic();
            if (mnemonic) {
              const localKeyPair = await getUserKeyPair(email, mnemonic);
              if (!active) return;
              if (localKeyPair?.privateKeyJwk) {
                setSharingPrivateKey(localKeyPair.privateKeyJwk);
                setKeyState("ready");
              } else {
                setKeyState("sharing-missing");
              }
            } else {
              if (!active) return;
              setKeyState("primary-missing");
            }
          }
        }

        await loadSharedFiles();
      } catch (error) {
        console.error("[SharedWithMe] Initialization failed:", error);
        if (active) {
          setKeyState("primary-missing");
          setIsLoading(false);
          setLoadError("The shared-file inbox could not be initialized.");
        }
      }
    };

    initialize();
    return () => {
      active = false;
    };
  }, [loadSharedFiles, navigate]);

  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sharedFiles;
    return sharedFiles.filter((file) =>
      file.name.toLowerCase().includes(query),
    );
  }, [searchQuery, sharedFiles]);

  const refreshInbox = () => {
    if (userEmail) void loadSharedFiles(true);
  };

  const ensureVaultMetadataReadyForSave = useCallback(async () => {
    if (!userEmail) throw new Error("Sign in again before saving this file.");

    const normalizedEmail = userEmail.trim().toLowerCase();
    const vaultState = vaultData?.state;
    const stateBelongsToCurrentUser =
      vaultState?.userEmail === normalizedEmail;

    if (stateBelongsToCurrentUser && vaultState?.metadataStatus === "ready") {
      return;
    }

    vaultData?.setVaultMetadataStatus(userEmail, "verifying");
    rememberVaultMetadataStatus(userEmail, "verifying");

    try {
      await fetchAndStoreFileMetadata();
      if (vaultData) {
        await vaultData.refreshVaultFromLocal(userEmail, {
          metadataStatus: "ready",
        });
      } else {
        rememberVaultMetadataStatus(userEmail, "ready");
      }
    } catch (error) {
      const isDecryptionError =
        error instanceof Error && error.name === "DecryptionError";
      const status = isDecryptionError ? "decryption_error" : "error";
      const message = isDecryptionError
        ? "ZeroDrive found an existing encrypted file list that this recovery phrase cannot open. Open Storage and review vault access before saving this file."
        : "ZeroDrive could not verify your Storage file list. Refresh Storage and try again before saving this file.";

      vaultData?.setVaultMetadataStatus(userEmail, status, message);
      rememberVaultMetadataStatus(userEmail, status);
      throw new Error(message);
    }
  }, [userEmail, vaultData]);

  const requireReadyKeys = (): boolean => {
    if (keyState === "ready") return true;

    if (keyState === "sharing-missing") {
      navigate("/share");
    } else if (keyState === "primary-missing") {
      navigate("/recovery-access?returnTo=%2Fshared-with-me");
    }
    return false;
  };

  const downloadDecryptedFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleFileAction = async (file: SharedFile, action: FileAction) => {
    if (!userEmail || !sharingPrivateKey || processing || !requireReadyKeys())
      return;

    setProcessing({ fileId: file.id, action, stage: "downloading" });
    try {
      if (action === "save") {
        setProcessing({ fileId: file.id, action, stage: "saving" });
        await ensureVaultMetadataReadyForSave();
        setProcessing({ fileId: file.id, action, stage: "downloading" });
      }

      const encryptedBlob = await downloadEncryptedFile(file.id);
      setProcessing({ fileId: file.id, action, stage: "decrypting" });
      const mnemonic = getMnemonic();
      let versionedKeyPair =
        file.recipientKeyVersion && mnemonic
          ? await getUserKeyPair(userEmail, mnemonic, file.recipientKeyVersion)
          : null;
      if (!versionedKeyPair && file.recipientKeyVersion && mnemonic) {
        versionedKeyPair = await recoverRsaKeyVersion(
          userEmail,
          file.recipientKeyVersion,
          mnemonic,
        );
      }
      const decrypted = await decryptSharedFile(
        encryptedBlob,
        file.encryptedFileKey,
        userEmail,
        file.name,
        file.mimeType,
        "",
        versionedKeyPair?.privateKeyJwk || sharingPrivateKey,
      );

      if (action === "download") {
        downloadDecryptedFile(decrypted.decryptedFile, decrypted.fileName);
        toast.success(`${decrypted.fileName} downloaded`);
      } else {
        setProcessing({ fileId: file.id, action, stage: "saving" });
        const fileForVault = new File(
          [decrypted.decryptedFile],
          decrypted.fileName,
          { type: file.mimeType },
        );
        const saved = await uploadAndSyncFile(fileForVault, userEmail);
        if (!saved) throw new Error("The file could not be saved to storage.");

        setSavedFileIds((current) => new Set(current).add(file.id));
        toast.success(`${decrypted.fileName} saved to My Storage`);
      }

      void Promise.resolve(apiClient.sharedFiles.recordAccess(file.id)).catch(
        () => {},
      );
    } catch (error) {
      console.error("[SharedWithMe] File action failed:", error);
      toast.error(
        action === "download"
          ? "File could not be downloaded"
          : "File could not be saved",
        {
          description: error instanceof Error ? error.message : "Unknown error",
        },
      );
    } finally {
      setProcessing(null);
    }
  };

  const renderKeyStatus = () => {
    if (keyState === "checking" || keyState === "ready") return null;

    const content = {
      "primary-missing": {
        component: (
          <VaultAccessRequired
            intent="inbox"
            onSetUpAccess={() =>
              navigate("/recovery-access?returnTo=%2Fshared-with-me")
            }
          />
        ),
      },
      "sharing-missing": {
        component: (
          <div className="flex flex-col gap-4 border p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center border">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">
                  Create your sharing identity
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  ZeroDrive needs a receiving key before other people can send
                  files that only you can unlock.
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/share")} size="sm">
              Create sharing identity
            </Button>
          </div>
        ),
      },
    }[keyState];

    return content.component;
  };

  const actionLabel = (fileId: string, action: FileAction) => {
    if (processing?.fileId !== fileId || processing.action !== action) {
      return action === "download" ? "Download" : "Save to Storage";
    }
    if (processing.stage === "downloading") return "Downloading";
    if (processing.stage === "decrypting") return "Decrypting";
    return "Saving";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl tracking-tight">Shared with me</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encrypted files sent to this ZeroDrive account. Your browser
            unlocks them only after the sender finalizes the share.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshInbox}
          disabled={isLoading || !userEmail}
        >
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {renderKeyStatus()}

      <div className="border">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <span className="text-sm font-medium">Inbox</span>
              {!isLoading && (
                <span className="text-xs text-muted-foreground">
                  {sharedFiles.length}{" "}
                  {sharedFiles.length === 1 ? "file" : "files"}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Files are downloaded and decrypted in this browser. Saving creates
              a separately encrypted copy in your personal Google Drive; the
              original share remains available until it expires.
            </p>
          </div>
          {sharedFiles.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search shared files"
                aria-label="Search shared files"
                className="pl-9"
              />
            </div>
          )}
        </div>

        {loadError ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <p className="mt-3 text-sm font-medium">Inbox unavailable</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshInbox}
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shared files
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {searchQuery ? "No matching files" : "Your inbox is empty"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {searchQuery
                ? "Try a different filename."
                : "Files shared to this ZeroDrive account will appear here after they are finalized."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredFiles.map((file) => {
              const isProcessing = processing?.fileId === file.id;
              const isSaved = savedFileIds.has(file.id);

              return (
                <article
                  key={file.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <img
                      src={getFileIconPath(file.mimeType)}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-medium">
                        {file.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatBytes(file.fileSize)} · Shared{" "}
                        {file.createdAt.toLocaleDateString()}
                        {file.expiresAt
                          ? ` · Expires ${file.expiresAt.toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-72">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileAction(file, "download")}
                        disabled={Boolean(processing) || keyState !== "ready"}
                      >
                        {isProcessing && processing.action === "download" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Download />
                        )}
                        {actionLabel(file.id, "download")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleFileAction(file, "save")}
                        disabled={
                          Boolean(processing) ||
                          keyState !== "ready" ||
                          isSaved
                        }
                      >
                        {isSaved ? (
                          <Check />
                        ) : isProcessing && processing.action === "save" ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <HardDrive />
                        )}
                        {isSaved
                          ? "Saved to Storage"
                          : actionLabel(file.id, "save")}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground sm:text-right">
                      Download saves plaintext to this device. Save to Storage
                      makes a fresh encrypted copy in your vault.
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
        Recipient-only access depends on your recovery phrase and this browser’s
        sharing key. ZeroDrive stores encrypted share data, not plaintext files.
      </div>
    </div>
  );
};

export default SharedWithMePage;
