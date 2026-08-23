import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileUp,
  HardDrive,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";
import { VaultAccessRequired } from "../components/vault-access-required";
import { useApp } from "../contexts/app-context";
import { getFileIconPath } from "../lib/mime-types";
import {
  fetchAndStoreFileMetadata,
  FileMeta,
  getAllFilesForUser,
} from "../utils/dexieDB";
import { decryptFile } from "../utils/decryptFile";
import {
  fetchRecipientPublicKey,
  fetchUserPublicKey,
  generateUserKeyPair,
  prepareFileForSharing,
  storeFileShare,
  storeUserPublicKey,
} from "../utils/fileSharing";
import apiClient, { DirectoryPublicKey } from "../utils/apiClient";
import { getRecipientKeyPin, pinRecipientKey } from "../utils/recipientKeyPins";
import {
  deleteUserKeyPair,
  getUserKeyPair,
  storeUserKeyPair,
} from "../utils/keyStorage";
import { uploadEncryptedRsaKeyToDrive } from "../utils/gdriveKeyStorage";
import { getMnemonic } from "../utils/mnemonicManager";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";
import { createSharingKeyBackupCapsule } from "../utils/capsuleAdapter";
import { ensureGoogleDrivePermissionForAction } from "../utils/googleDrivePermissions";

type PageState =
  | "checking"
  | "access"
  | "setup"
  | "compose"
  | "review"
  | "invite"
  | "sharing"
  | "success";

type ShareStage = "preparing" | "encrypting" | "uploading" | "finishing";
type FileSource = "device" | "storage";

type CachedShareSetupState = "compose";

const SHARE_SETUP_CACHE_KEY = "zerodrive-share-setup-cache";
const SHARE_SETUP_CACHE_TTL = 5 * 60 * 1000;

interface ShareReceipt {
  fileName: string;
  recipientEmail: string;
  expiresAt: Date;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readCachedShareSetupState(email: string): CachedShareSetupState | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const cached = localStorage.getItem(SHARE_SETUP_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as {
      email?: string;
      state?: CachedShareSetupState;
      timestamp?: number;
    };

    if (
      normalizeEmail(parsed.email || "") !== normalizedEmail ||
      !parsed.timestamp ||
      Date.now() - parsed.timestamp > SHARE_SETUP_CACHE_TTL
    ) {
      localStorage.removeItem(SHARE_SETUP_CACHE_KEY);
      return null;
    }

    return parsed.state === "compose" ? parsed.state : null;
  } catch {
    return null;
  }
}

function writeCachedShareSetupState(
  email: string,
  state: CachedShareSetupState | null,
): void {
  try {
    if (!email || !state) {
      localStorage.removeItem(SHARE_SETUP_CACHE_KEY);
      return;
    }

    localStorage.setItem(
      SHARE_SETUP_CACHE_KEY,
      JSON.stringify({
        email: normalizeEmail(email),
        state,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Best-effort UI cache only.
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

async function syncPublicKeyIfNeeded(
  email: string,
  mnemonic: string,
): Promise<void> {
  try {
    const serverKey = await fetchUserPublicKey(email);
    if (serverKey) return;

    const localKeyPair = await getUserKeyPair(email, mnemonic);
    if (localKeyPair?.publicKeyJwk) {
      await storeUserPublicKey(localKeyPair.publicKeyJwk);
    }
  } catch (error) {
    console.error("[Share] Public-key sync failed:", error);
  }
}

function StepIndicator({
  current,
}: {
  current: "file" | "recipient" | "review";
}) {
  const steps = [
    { id: "file", label: "File" },
    { id: "recipient", label: "Recipient" },
    { id: "review", label: "Review" },
  ] as const;
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <ol className="grid grid-cols-3 border" aria-label="Sharing progress">
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step.id}
            className={`flex items-center gap-2 border-r px-3 py-2.5 text-xs last:border-r-0 sm:px-4 ${
              active ? "bg-muted/60 text-foreground" : "text-muted-foreground"
            }`}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center border text-[10px] ${
                complete ? "bg-foreground text-background" : ""
              }`}
              aria-hidden="true"
            >
              {complete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className={active ? "font-medium" : ""}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const ShareFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { userEmail } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openKeyManagement = () =>
    navigate("/recovery-access?returnTo=%2Fshare");

  const [pageState, setPageState] = useState<PageState>(
    () => readCachedShareSetupState(userEmail) || "checking",
  );
  const [senderEmail, setSenderEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [storedFile, setStoredFile] = useState<FileMeta | null>(null);
  const [fileSource, setFileSource] = useState<FileSource>("device");
  const [storageFiles, setStorageFiles] = useState<FileMeta[]>([]);
  const [storageSearch, setStorageSearch] = useState("");
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [recipientVerified, setRecipientVerified] = useState(false);
  const [recipientDirectoryKey, setRecipientDirectoryKey] =
    useState<DirectoryPublicKey | null>(null);
  const [changedRecipientKey, setChangedRecipientKey] =
    useState<DirectoryPublicKey | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const [shareStage, setShareStage] = useState<ShareStage>("encrypting");
  const [shareError, setShareError] = useState("");
  const [receipt, setReceipt] = useState<ShareReceipt | null>(null);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const { getUserEmail, hasGoogleTokensInStorage, logout } =
          await import("../utils/authService");
        const email = await getUserEmail();

        if (!email || !hasGoogleTokensInStorage()) {
          await logout();
          window.location.href = "/";
          return;
        }

        try {
          const { initializeGapi } = await import("../utils/gapiInit");
          await initializeGapi();
        } catch (error) {
          console.error("[Share] Google Drive initialization failed:", error);
        }

        if (!active) return;
        setSenderEmail(email);

        if (!getMnemonic()) {
          writeCachedShareSetupState(email, null);
          setPageState("access");
          return;
        }

        const [result, serverPublicKey] = await Promise.all([
          recoverRsaKeysIfNeeded(email, true),
          fetchUserPublicKey(email).catch(() => null),
        ]);
        if (!active) return;

        if (result.keysExisted || result.recovered || serverPublicKey) {
          const mnemonic = getMnemonic();
          if (mnemonic) {
            await syncPublicKeyIfNeeded(email, mnemonic);
          }
          if (active) {
            writeCachedShareSetupState(email, "compose");
            setPageState("compose");
          }
        } else {
          writeCachedShareSetupState(email, null);
          setPageState("setup");
        }
      } catch (error) {
        console.error("[Share] Failed to initialize:", error);
        if (active) {
          setShareError("We could not check your sharing setup. Try again.");
          setPageState("setup");
        }
      }
    };

    initialize();
    return () => {
      active = false;
    };
  }, []);

  const rollbackKeyGeneration = async (email: string) => {
    try {
      await deleteUserKeyPair(email);
      await apiClient.publicKeys.delete();
    } catch (error) {
      console.error("[Share] Key rollback failed:", error);
    }
  };

  const handleGenerateKeys = async () => {
    if (!senderEmail || isGeneratingKeys) return;

    setIsGeneratingKeys(true);
    setShareError("");

    try {
      const mnemonic = getMnemonic();

      if (!mnemonic) {
        toast.info("Set up your encryption key first");
        openKeyManagement();
        return;
      }

      const keyPair = await generateUserKeyPair();
      const storedPublicKey = await storeUserPublicKey(keyPair.publicKeyJwk);
      await storeUserKeyPair(
        senderEmail,
        keyPair,
        mnemonic,
        storedPublicKey.keyVersion,
      );

      try {
        const encryptedPrivateKey = await createSharingKeyBackupCapsule({
          privateKeyJwk: keyPair.privateKeyJwk,
          publicKeyJwk: keyPair.publicKeyJwk,
          keyVersion: storedPublicKey.keyVersion,
          fingerprint: storedPublicKey.fingerprint,
          recoveryPhrase: mnemonic,
        });
        const backupId =
          await uploadEncryptedRsaKeyToDrive(encryptedPrivateKey);
        if (!backupId) throw new Error("Google Drive backup failed");
        await uploadEncryptedRsaKeyToDrive(
          encryptedPrivateKey,
          storedPublicKey.keyVersion,
        );
      } catch (error) {
        await rollbackKeyGeneration(senderEmail);
        throw error;
      }

      toast.success("File sharing is ready");
      writeCachedShareSetupState(senderEmail, "compose");
      setPageState("compose");
    } catch (error) {
      console.error("[Share] Failed to enable sharing:", error);
      setShareError(
        error instanceof Error
          ? error.message
          : "Sharing setup failed. Check your connection and try again.",
      );
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const hasSelectedFile = Boolean(file || storedFile);
  const selectedFileName = file?.name || storedFile?.name || "";
  const selectedMimeType = file?.type || storedFile?.mimeType || "";
  const filteredStorageFiles = storageFiles.filter((stored) =>
    stored.name.toLowerCase().includes(storageSearch.trim().toLowerCase()),
  );

  const loadStorageFiles = async (forceRefresh = false) => {
    if (!senderEmail || isLoadingStorage) return;
    if (storageLoaded && !forceRefresh) return;

    setIsLoadingStorage(true);
    setShareError("");
    try {
      if (forceRefresh || !storageLoaded) {
        try {
          await fetchAndStoreFileMetadata();
        } catch (error) {
          console.warn(
            "[Share] Could not refresh storage metadata; using local cache:",
            error,
          );
        }
      }
      const files = await getAllFilesForUser(senderEmail);
      setStorageFiles(
        [...files].sort(
          (a, b) =>
            new Date(b.uploadedDate).getTime() -
            new Date(a.uploadedDate).getTime(),
        ),
      );
      setStorageLoaded(true);
    } catch (error) {
      console.error("[Share] Failed to load stored files:", error);
      setShareError("Your stored files could not be loaded. Try refreshing.");
    } finally {
      setIsLoadingStorage(false);
    }
  };

  const chooseFileSource = (source: FileSource) => {
    setFileSource(source);
    setShareError("");
    if (source === "storage") void loadStorageFiles();
  };

  const selectFile = (selectedFile?: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setStoredFile(null);
    setFileSource("device");
    setShareError("");
  };

  const selectStoredFile = (selectedFile: FileMeta) => {
    setStoredFile(selectedFile);
    setFile(null);
    setFileSource("storage");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShareError("");
  };

  const removeFile = () => {
    setFile(null);
    setStoredFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  };

  const handleRecipientChange = (value: string) => {
    setRecipientEmail(value);
    setRecipientError("");
    setRecipientVerified(false);
    setRecipientDirectoryKey(null);
    setChangedRecipientKey(null);
  };

  const validateRecipient = async (): Promise<boolean> => {
    const normalizedEmail = recipientEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setRecipientError("Enter the recipient's email address.");
      return false;
    }
    if (!emailPattern.test(normalizedEmail)) {
      setRecipientError("Enter a valid email address.");
      return false;
    }
    if (normalizedEmail === senderEmail.trim().toLowerCase()) {
      setRecipientError("Choose someone other than your own account.");
      return false;
    }

    setIsCheckingRecipient(true);
    setRecipientError("");
    try {
      const publicKey = await fetchRecipientPublicKey(normalizedEmail);
      setRecipientEmail(normalizedEmail);

      if (!publicKey) {
        setRecipientVerified(false);
        setPageState("invite");
        return false;
      }

      const pinnedKey = getRecipientKeyPin(normalizedEmail);
      if (pinnedKey && pinnedKey.fingerprint !== publicKey.fingerprint) {
        setRecipientVerified(false);
        setChangedRecipientKey(publicKey);
        setRecipientError(
          "This recipient's encryption key changed. Confirm the new fingerprint before sharing.",
        );
        return false;
      }

      if (!pinnedKey) {
        pinRecipientKey(
          normalizedEmail,
          publicKey.fingerprint,
          publicKey.key_version,
        );
      }
      setRecipientDirectoryKey(publicKey);
      setChangedRecipientKey(null);
      setRecipientVerified(true);
      return true;
    } catch (error) {
      console.error("[Share] Recipient lookup failed:", error);
      setRecipientError("We could not check this recipient. Try again.");
      return false;
    } finally {
      setIsCheckingRecipient(false);
    }
  };

  const continueToReview = async () => {
    if (!ensureGoogleDrivePermissionForAction("share")) return;

    if (!hasSelectedFile) {
      setShareError("Choose a file before continuing.");
      return;
    }

    const validRecipient = recipientVerified || (await validateRecipient());
    if (validRecipient) {
      if (recipientDirectoryKey) {
        pinRecipientKey(
          recipientEmail,
          recipientDirectoryKey.fingerprint,
          recipientDirectoryKey.key_version,
        );
      }
      setShareError("");
      setPageState("review");
    }
  };

  const confirmChangedRecipientKey = () => {
    if (!changedRecipientKey) return;
    pinRecipientKey(
      recipientEmail,
      changedRecipientKey.fingerprint,
      changedRecipientKey.key_version,
    );
    setRecipientDirectoryKey(changedRecipientKey);
    setChangedRecipientKey(null);
    setRecipientError("");
    setRecipientVerified(true);
  };

  const getFileForSharing = async (): Promise<File> => {
    if (file) return file;
    if (!storedFile) throw new Error("Choose a file before continuing.");

    setShareStage("preparing");
    const { getGoogleAccessToken } = await import("../utils/gapiInit");
    const token = await getGoogleAccessToken();
    if (!token) {
      throw new Error(
        "Google Drive is not connected. Sign in again and retry.",
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${storedFile.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Could not download ${storedFile.name} from your storage.`,
      );
    }

    const encryptedBlob = await response.blob();
    const decrypted = await decryptFile(encryptedBlob, storedFile);
    return new File([decrypted.contentBlob], decrypted.fileName, {
      type: decrypted.mimeType,
      lastModified: new Date(storedFile.uploadedDate).getTime(),
    });
  };

  const handleShareFile = async () => {
    if (!hasSelectedFile || !senderEmail || !recipientVerified) return;

    if (!ensureGoogleDrivePermissionForAction("share")) return;

    if (!getMnemonic()) {
      setShareError("Set up vault access before sharing files.");
      setPageState("access");
      return;
    }

    setPageState("sharing");
    setShareStage(storedFile ? "preparing" : "encrypting");
    setShareError("");

    try {
      const fileToShare = await getFileForSharing();
      setShareStage("encrypting");
      const preparation = await prepareFileForSharing(
        fileToShare,
        recipientEmail,
        customMessage.trim() || undefined,
        recipientDirectoryKey || undefined,
      );

      setShareStage("uploading");
      await storeFileShare(
        crypto.randomUUID(),
        "encrypted-share",
        preparation,
        () => setShareStage("finishing"),
      );

      const completedReceipt: ShareReceipt = {
        fileName: fileToShare.name,
        recipientEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      setReceipt(completedReceipt);
      setPageState("success");
    } catch (error) {
      console.error("[Share] File sharing failed:", error);
      if (
        error instanceof Error &&
        error.message.includes("has not registered")
      ) {
        setRecipientVerified(false);
        setPageState("invite");
        return;
      }

      setShareError(
        error instanceof Error
          ? error.message
          : "The file could not be shared. Try again.",
      );
      setPageState("review");
    }
  };

  const handleSendInvitation = async () => {
    if (!recipientEmail || isSendingInvitation) return;

    setIsSendingInvitation(true);
    setShareError("");
    try {
      const result = await apiClient.invitations.send({
        recipient_email: recipientEmail,
        sender_message: customMessage.trim() || undefined,
      });
      setInvitationSent(true);
      toast.success("Invitation sent", {
        description: `${result.remaining} invitations remaining this hour.`,
      });
    } catch (error) {
      console.error("[Share] Invitation failed:", error);
      setShareError(
        error instanceof Error
          ? error.message
          : "The invitation could not be sent.",
      );
    } finally {
      setIsSendingInvitation(false);
    }
  };

  const startAnotherShare = () => {
    removeFile();
    setFileSource("device");
    setStorageSearch("");
    setRecipientEmail("");
    setRecipientError("");
    setRecipientVerified(false);
    setCustomMessage("");
    setShowMessage(false);
    setShareError("");
    setInvitationSent(false);
    setReceipt(null);
    setPageState("compose");
  };

  const renderError = () =>
    shareError ? (
      <div
        className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
        <span>{shareError}</span>
      </div>
    ) : null;

  const renderPrerequisite = () => {
    if (pageState === "checking") {
      return (
        <div className="flex min-h-72 flex-col items-center justify-center border">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Checking sharing setup</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This should only take a moment.
          </p>
        </div>
      );
    }

    if (pageState === "access") {
      return (
        <VaultAccessRequired
          intent="share"
          onSetUpAccess={openKeyManagement}
        />
      );
    }

    if (pageState === "setup") {
      return (
        <div className="border">
          <div className="border-b p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center border">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">
              Create your sharing identity
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This creates the public receiving key other people use to send
              files to you, plus the private key your browser uses when you send
              or receive shared files. The private key is encrypted before it is
              backed up to your Google Drive.
            </p>
          </div>
          <div className="space-y-4 p-6 sm:p-8">
            {renderError()}
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-600" />
                <span>Generated on this device</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-600" />
                <span>Encrypted before backup</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-green-600" />
                <span>Never visible to ZeroDrive</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                onClick={handleGenerateKeys}
                disabled={isGeneratingKeys || !senderEmail}
              >
                {isGeneratingKeys ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Creating identity
                  </>
                ) : (
                  <>
                    <KeyRound />
                    Create sharing identity
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={openKeyManagement}
                disabled={isGeneratingKeys}
              >
                Manage encryption key
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <VaultAccessRequired intent="share" onSetUpAccess={openKeyManagement} />
    );
  };

  const renderCompose = () => (
    <div className="space-y-5">
      <StepIndicator current={hasSelectedFile ? "recipient" : "file"} />

      <div className="border">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Choose a file</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a new file from this device or one already in your encrypted
            storage.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <input
            ref={fileInputRef}
            id="share-file-input"
            type="file"
            className="sr-only"
            aria-label="File to share"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

          {!hasSelectedFile && (
            <div
              className="grid grid-cols-2 border"
              role="tablist"
              aria-label="File source"
            >
              <button
                type="button"
                role="tab"
                aria-selected={fileSource === "device"}
                onClick={() => chooseFileSource("device")}
                className={`flex items-center justify-center gap-2 border-r px-4 py-2.5 text-xs font-medium ${
                  fileSource === "device" ? "bg-muted/60" : "hover:bg-muted/30"
                }`}
              >
                <FileUp className="h-4 w-4" />
                From this device
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileSource === "storage"}
                onClick={() => chooseFileSource("storage")}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium ${
                  fileSource === "storage" ? "bg-muted/60" : "hover:bg-muted/30"
                }`}
              >
                <HardDrive className="h-4 w-4" />
                My Storage
              </button>
            </div>
          )}

          {hasSelectedFile ? (
            <div className="flex items-center gap-4 border p-4">
              <img
                src={getFileIconPath(selectedMimeType)}
                alt=""
                className="h-10 w-10 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedFileName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {file
                    ? `${formatBytes(file.size)}${file.type ? ` · ${file.type}` : ""}`
                    : `Already in My Storage${storedFile?.mimeType ? ` · ${storedFile.mimeType}` : ""}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeFile}
                aria-label="Remove selected file"
              >
                <X />
              </Button>
            </div>
          ) : fileSource === "device" ? (
            <div
              className={`flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed px-5 text-center transition-colors ${
                isDragging
                  ? "border-foreground bg-muted/60"
                  : "hover:bg-muted/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Choose a file to share"
            >
              <FileUp className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                Drop a file here or choose from your device
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The original file never reaches our server.
              </p>
              <span className="mt-4 inline-flex h-8 items-center gap-2 border px-3 text-xs font-medium">
                <Upload />
                Choose file
              </span>
            </div>
          ) : (
            <div className="border">
              <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
                <Input
                  value={storageSearch}
                  onChange={(event) => setStorageSearch(event.target.value)}
                  placeholder="Search your storage"
                  aria-label="Search your storage"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadStorageFiles(true)}
                  disabled={isLoadingStorage}
                >
                  <RefreshCw
                    className={isLoadingStorage ? "animate-spin" : ""}
                  />
                  Refresh
                </Button>
              </div>

              {isLoadingStorage ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your files
                </div>
              ) : filteredStorageFiles.length > 0 ? (
                <div
                  className="max-h-72 divide-y overflow-y-auto"
                  aria-label="Files in My Storage"
                >
                  {filteredStorageFiles.map((stored) => (
                    <button
                      key={stored.id}
                      type="button"
                      onClick={() => selectStoredFile(stored)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <img
                        src={getFileIconPath(stored.mimeType)}
                        alt=""
                        className="h-8 w-8 flex-shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {stored.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Added{" "}
                          {new Date(stored.uploadedDate).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
                  <HardDrive className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    {storageSearch
                      ? "No matching files"
                      : "Your storage is empty"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {storageSearch
                      ? "Try a different search."
                      : "Upload a file in Storage, then return here to share it."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Choose the recipient</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your browser checks the recipient’s public key first. Then it locks
            the file so only that recipient can unlock it.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Email address</Label>
            <div className="relative">
              <Input
                id="recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(event) => handleRecipientChange(event.target.value)}
                placeholder="recipient@example.com"
                className={recipientVerified ? "pr-10" : ""}
                aria-invalid={Boolean(recipientError)}
                aria-describedby={
                  recipientError ? "recipient-error" : "recipient-help"
                }
                disabled={isCheckingRecipient}
              />
              {recipientVerified && (
                <Check className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />
              )}
            </div>
            {recipientError ? (
              <div id="recipient-error" className="space-y-3">
                <p className="text-xs text-destructive">{recipientError}</p>
                {changedRecipientKey && (
                  <div className="border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-medium">New key fingerprint</p>
                    <code className="mt-1 block break-all text-[11px] text-muted-foreground">
                      {changedRecipientKey.fingerprint}
                    </code>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Verify this fingerprint with the recipient through another
                      channel. First-contact trust depends on the ZeroDrive
                      directory.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={confirmChangedRecipientKey}
                    >
                      Trust this new key
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p id="recipient-help" className="text-xs text-muted-foreground">
                {recipientVerified
                  ? "Recipient key found. This file will be locked for this account only."
                  : "The recipient needs a ZeroDrive sharing identity before they can receive files."}
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowMessage((visible) => !visible)}
              className="flex items-center gap-2 text-sm font-medium hover:underline"
              aria-expanded={showMessage}
            >
              <Mail className="h-4 w-4" />
              {showMessage
                ? "Remove personal message"
                : "Add a personal message"}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </button>
            {showMessage && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="custom-message">Message</Label>
                <Textarea
                  id="custom-message"
                  value={customMessage}
                  onChange={(event) =>
                    setCustomMessage(event.target.value.slice(0, 500))
                  }
                  placeholder="Add context for the recipient..."
                  maxLength={500}
                  rows={4}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    The message stays encrypted. The email notification stays generic.
                  </span>
                  <span>{customMessage.length}/500</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {renderError()}

      <div className="flex justify-end">
        <Button
          onClick={continueToReview}
          disabled={
            !hasSelectedFile || !recipientEmail.trim() || isCheckingRecipient
          }
        >
          {isCheckingRecipient ? (
            <>
              <Loader2 className="animate-spin" />
              Checking recipient
            </>
          ) : (
            <>
              Review share
              <Send />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-5">
      <StepIndicator current="review" />
      <div className="border">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Review before sharing</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your browser will create a separate encrypted copy, lock it to this
            recipient’s key, and expire it automatically after seven days.
          </p>
        </div>
        <dl className="divide-y">
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <dt className="text-xs text-muted-foreground">File</dt>
            <dd className="flex min-w-0 items-center gap-3 text-sm">
              {hasSelectedFile && (
                <img
                  src={getFileIconPath(selectedMimeType)}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              )}
              <span className="truncate">{selectedFileName}</span>
              <span className="flex-shrink-0 text-xs text-muted-foreground">
                {file ? formatBytes(file.size) : "From My Storage"}
              </span>
            </dd>
          </div>
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <dt className="text-xs text-muted-foreground">Recipient</dt>
            <dd className="flex items-center gap-2 text-sm">
              {recipientEmail}
              <Check className="h-4 w-4 text-green-600" />
            </dd>
          </div>
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <dt className="text-xs text-muted-foreground">Notification</dt>
            <dd className="space-y-1 text-sm">
              <span>Generic email notification</span>
              {customMessage.trim() && (
                <span className="block text-xs text-muted-foreground">
                  Your message is included only inside the encrypted share.
                </span>
              )}
            </dd>
          </div>
          {customMessage.trim() && (
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
              <dt className="text-xs text-muted-foreground">Message</dt>
              <dd className="whitespace-pre-wrap text-sm">
                {customMessage.trim()}
              </dd>
            </div>
          )}
          <div className="grid gap-1 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <dt className="text-xs text-muted-foreground">Protection</dt>
            <dd className="space-y-1 text-sm">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Recipient-only encrypted copy · expires in 7 days
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                ZeroDrive stores ciphertext and encrypted metadata. The
                recipient’s browser needs their private sharing key to unlock
                the file.
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {renderError()}

      <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
        <Button variant="outline" onClick={() => setPageState("compose")}>
          <ArrowLeft />
          Edit details
        </Button>
        <Button onClick={handleShareFile}>
          <LockKeyhole />
          Encrypt and share
        </Button>
      </div>
    </div>
  );

  const renderInvitation = () => (
    <div className="border">
      <div className="border-b p-6 sm:p-8">
        <div className="flex h-10 w-10 items-center justify-center border">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">
          This recipient is not ready yet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{recipientEmail}</span>{" "}
          has not enabled encrypted sharing. Invite them to ZeroDrive, then try
          again after they finish setup.
        </p>
      </div>
      <div className="space-y-4 p-6 sm:p-8">
        {invitationSent && (
          <div
            className="flex items-start gap-2 border bg-muted/40 px-4 py-3 text-sm"
            role="status"
          >
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <span>
              Invitation sent. You can share the file after the recipient
              enables sharing.
            </span>
          </div>
        )}
        {customMessage.trim() && (
          <div className="border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Your invitation message
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {customMessage.trim()}
            </p>
          </div>
        )}
        {renderError()}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleSendInvitation}
            disabled={isSendingInvitation || invitationSent}
          >
            {isSendingInvitation ? (
              <>
                <Loader2 className="animate-spin" />
                Sending invitation
              </>
            ) : (
              <>
                <Mail />
                Send invitation
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRecipientEmail("");
              setRecipientError("");
              setRecipientVerified(false);
              setInvitationSent(false);
              setShareError("");
              setPageState("compose");
            }}
            disabled={isSendingInvitation}
          >
            Choose someone else
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSharing = () => {
    const stages: Record<
      ShareStage,
      { title: string; description: string; progress: number }
    > = {
      preparing: {
        title: "Preparing your stored file",
        description:
          "Downloading and decrypting it on this device before creating a separate shared copy.",
        progress: 15,
      },
      encrypting: {
        title: "Encrypting on this device",
        description: "Your original file is not being uploaded.",
        progress: 30,
      },
      uploading: {
        title: "Uploading the encrypted copy",
        description:
          "Only ciphertext and encrypted key material leave this device.",
        progress: 70,
      },
      finishing: {
        title: "Creating the secure share",
        description: "Finishing the recipient record and expiration settings.",
        progress: 95,
      },
    };
    const stage = stages[shareStage];

    return (
      <div className="flex min-h-80 flex-col items-center justify-center border px-6 text-center">
        <Loader2 className="h-7 w-7 animate-spin" />
        <h2 className="mt-5 text-lg font-semibold">{stage.title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {stage.description}
        </p>
        <Progress
          value={stage.progress}
          className="mt-6 h-1.5 max-w-md"
          aria-label="File sharing progress"
        />
        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {stage.progress}% complete · keep this tab open
        </p>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="border">
      <div className="flex flex-col items-center border-b px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center border bg-foreground text-background">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">File shared</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {receipt?.fileName}
          </span>{" "}
          is ready for{" "}
          <span className="font-medium text-foreground">
            {receipt?.recipientEmail}
          </span>
          .
          {" "}Only this recipient can unlock the encrypted copy, and the share
          expires automatically.
        </p>
      </div>
      <div className="space-y-5 p-6 sm:p-8">
        <div className="grid gap-3 border p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Protection</p>
            <p className="mt-1">Locked to the recipient’s key</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available until</p>
            <p className="mt-1">
              {receipt?.expiresAt.toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={startAnotherShare}>
            <FileUp />
            Share another file
          </Button>
          <Button variant="outline" onClick={() => navigate("/home")}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (["checking", "access", "setup"].includes(pageState)) {
      return renderPrerequisite();
    }
    if (pageState === "compose") return renderCompose();
    if (pageState === "review") return renderReview();
    if (pageState === "invite") return renderInvitation();
    if (pageState === "sharing") return renderSharing();
    return renderSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl tracking-tight">Share a file</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your browser locks the file so only the chosen recipient can unlock
            it.
          </p>
        </div>
      </div>

      <div className="max-w-4xl">{renderContent()}</div>
    </div>
  );
};

export default ShareFilesPage;
