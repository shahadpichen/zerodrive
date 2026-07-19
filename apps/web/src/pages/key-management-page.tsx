import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileKey,
  KeyRound,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  deriveKeyFromMnemonic,
  generateMnemonic,
  storeKey,
} from "../utils/cryptoUtils";
import { setMnemonic } from "../utils/mnemonicManager";
import { testEncryptionKey } from "../utils/keyTest";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";
import { getUserEmail, hasGoogleTokensInStorage } from "../utils/authService";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { DeviceManagement } from "../components/key-management/DeviceManagement";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";

type KeyMode = "recover" | "generate";
const allowedReturnTargets = new Set([
  "/home",
  "/storage",
  "/share",
  "/shared-with-me",
]);

export const KeyManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo =
    requestedReturnTo && allowedReturnTargets.has(requestedReturnTo)
      ? requestedReturnTo
      : "/storage";
  const returnLabel = {
    "/home": "Continue to Home",
    "/share": "Continue to Share Files",
    "/shared-with-me": "Continue to Shared Files",
    "/storage": "Continue to Storage",
  }[returnTo];

  const [mode, setMode] = useState<KeyMode>("recover");
  const [inputMnemonic, setInputMnemonic] = useState("");
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(
    null,
  );
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showGenerateWarning, setShowGenerateWarning] = useState(false);
  const [understandLoss, setUnderstandLoss] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [keyStatusVersion, setKeyStatusVersion] = useState(0);

  useEffect(() => {
    const initializeDrive = async () => {
      try {
        const { initializeGapi } = await import("../utils/gapiInit");
        await initializeGapi();
        setIsGapiReady(true);
      } catch (initializationError) {
        console.error(
          "[KeyManagement] Google Drive initialization failed:",
          initializationError,
        );
        toast.warning("Google Drive connection unavailable", {
          description:
            "Your primary key still works, but sharing-key recovery is unavailable.",
        });
      }
    };

    initializeDrive();
  }, []);

  const recoverSharingKeys = async () => {
    if (!isGapiReady || !hasGoogleTokensInStorage()) return;

    try {
      const email = await getUserEmail();
      if (email) await recoverRsaKeysIfNeeded(email, true);
    } catch (recoveryError) {
      console.error(
        "[KeyManagement] Sharing-key recovery failed:",
        recoveryError,
      );
      // The primary key is still valid, so this must not block the user.
    }
  };

  const switchMode = (nextMode: KeyMode) => {
    setMode(nextMode);
    setError("");
    setInputMnemonic("");
    if (nextMode === "recover") setGeneratedMnemonic(null);
  };

  const openGenerateWarning = () => {
    setShowGenerateWarning(true);
    setUnderstandLoss(false);
    setReadyToSave(false);
  };

  const handleGenerateKey = async () => {
    setShowGenerateWarning(false);
    setIsGenerating(true);
    setError("");

    try {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);
      setMnemonic(mnemonic);
      await storeKey(key);
      setGeneratedMnemonic(mnemonic);
      setKeyStatusVersion((version) => version + 1);
      await recoverSharingKeys();
      toast.success("Encryption key created");
    } catch (generationError) {
      console.error("[KeyManagement] Key generation failed:", generationError);
      setError("Your encryption key could not be created. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecoverKey = async () => {
    const mnemonic = inputMnemonic.trim();
    if (!mnemonic || isRecovering) return;

    setIsRecovering(true);
    setError("");
    try {
      const key = await deriveKeyFromMnemonic(mnemonic);
      setMnemonic(mnemonic);
      await storeKey(key);
      setKeyStatusVersion((version) => version + 1);
      await recoverSharingKeys();
      toast.success("Encryption key recovered");
      navigate(returnTo);
    } catch (recoveryError) {
      console.error("Error loading key from mnemonic:", recoveryError);
      setError(
        "That recovery phrase is not valid. Check the words and their order.",
      );
    } finally {
      setIsRecovering(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    setError("");

    try {
      const keyJwk = JSON.parse(await file.text());
      if (keyJwk.kty !== "oct" || !keyJwk.k || keyJwk.alg !== "A256GCM") {
        throw new Error("Invalid AES-GCM key");
      }

      const key = await crypto.subtle.importKey(
        "jwk",
        keyJwk,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );
      await storeKey(key);
      setKeyStatusVersion((version) => version + 1);
      toast.success("Legacy key imported", {
        description: "The key is active in this browser tab.",
      });
      navigate(returnTo);
    } catch (importError) {
      console.error("[KeyManagement] Key import failed:", importError);
      setError("This is not a valid ZeroDrive AES-GCM JSON key file.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleDownloadMnemonic = () => {
    if (!generatedMnemonic) return;

    const blob = new Blob([generatedMnemonic], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zerodrive-recovery-phrase.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Recovery phrase downloaded");
  };

  const handleCopyMnemonic = async () => {
    if (!generatedMnemonic) return;
    try {
      await navigator.clipboard.writeText(generatedMnemonic);
      toast.success("Recovery phrase copied");
    } catch {
      toast.error("Could not copy the recovery phrase");
    }
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    try {
      const result = await testEncryptionKey();
      if (result.success) {
        toast.success("Encryption key verified");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("The encryption-key test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const renderError = () =>
    error ? (
      <div
        className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
        <span>{error}</span>
      </div>
    ) : null;

  const renderRecovery = () => (
    <div className="border">
      <div className="border-b p-5 sm:p-6">
        <div className="flex h-9 w-9 items-center justify-center border">
          <KeyRound className="h-4 w-4" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Recover your key</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Enter the recovery phrase you saved when you created your encryption
          key.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="mnemonicInput">Recovery phrase</Label>
          <Textarea
            id="mnemonicInput"
            value={inputMnemonic}
            onChange={(event) => {
              setInputMnemonic(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                handleRecoverKey();
              }
            }}
            placeholder="Enter your 12-word recovery phrase"
            rows={4}
            autoComplete="off"
            spellCheck={false}
            disabled={isRecovering}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Processed only in this browser tab and never sent to the server.
          </div>
        </div>

        {renderError()}

        <Button
          onClick={handleRecoverKey}
          disabled={!inputMnemonic.trim() || isRecovering}
          className="w-full sm:w-auto"
        >
          {isRecovering ? (
            <>
              <Loader2 className="animate-spin" />
              Recovering key
            </>
          ) : (
            <>
              <KeyRound />
              Recover and continue
            </>
          )}
        </Button>

        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowFileUpload((visible) => !visible)}
            className="flex items-center gap-2 text-xs font-medium hover:underline"
            aria-expanded={showFileUpload}
          >
            <FileKey className="h-4 w-4" />
            Import a legacy JSON key
          </button>

          {showFileUpload && (
            <div className="mt-4 border p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use this only if you previously downloaded an
                <span className="mx-1 font-medium text-foreground">
                  encryption-key.json
                </span>
                file. Keep that JSON file as your backup.
              </p>
              <Label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 border px-4 text-xs font-medium hover:bg-muted/40">
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isImporting ? "Importing key" : "Choose JSON key"}
                <Input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="sr-only"
                  disabled={isImporting}
                  aria-label="Upload your encryption key file"
                />
              </Label>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGeneratedKey = () => {
    if (!generatedMnemonic) return null;
    const words = generatedMnemonic.split(" ");

    return (
      <div className="border">
        <div className="border-b p-5 sm:p-6">
          <div className="flex h-10 w-10 items-center justify-center border bg-foreground text-background">
            <Check className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">
            Your vault is ready
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Save this recovery phrase now. After that, you can upload your first
            encrypted file or return to what you were doing.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 border sm:grid-cols-3">
            {words.map((word, index) => (
              <div
                key={`${word}-${index}`}
                className="flex items-center gap-2 border-b border-r px-3 py-3 text-sm"
              >
                <span className="w-5 text-[10px] text-muted-foreground">
                  {index + 1}.
                </span>
                <span className="font-medium">{word}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyMnemonic}>
              <Clipboard />
              Copy phrase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMnemonic}
            >
              <Download />
              Download phrase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestKey}
              disabled={isTesting}
            >
              {isTesting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ShieldCheck />
              )}
              {isTesting ? "Testing key" : "Test key"}
            </Button>
          </div>

          <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <span>
              Anyone with this phrase can decrypt your files. ZeroDrive cannot
              recover it if you lose it.
            </span>
          </div>

          <Button
            onClick={() => navigate(returnTo)}
            className="w-full sm:w-auto"
          >
            {returnTo === "/storage" ? "Upload first encrypted file" : returnLabel}
          </Button>
        </div>
      </div>
    );
  };

  const renderGeneration = () =>
    generatedMnemonic ? (
      renderGeneratedKey()
    ) : (
      <div className="border">
        <div className="border-b p-5 sm:p-6">
          <div className="flex h-9 w-9 items-center justify-center border">
            <KeyRound className="h-4 w-4" />
          </div>
          <h2 className="mt-4 text-base font-semibold">
            Create a new encryption key
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Use this for a new vault. Creating another key will not decrypt
            files protected by an older one.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-green-600" />
              <span>Generated locally</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-green-600" />
              <span>12-word recovery</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-green-600" />
              <span>No server copy</span>
            </div>
          </div>

          {renderError()}

          <Button onClick={openGenerateWarning} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" />
                Creating key
              </>
            ) : (
              <>
                <KeyRound />
                Create new key
              </>
            )}
          </Button>
        </div>
      </div>
    );

  return (
    <>
      <Dialog open={showGenerateWarning} onOpenChange={setShowGenerateWarning}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Before you create a new key
            </DialogTitle>
            <DialogDescription>
              This recovery phrase cannot be reset or replaced.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm leading-relaxed">
              Files encrypted with this key are permanently inaccessible if the
              recovery phrase is lost.
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="understand-loss"
                  checked={understandLoss}
                  onCheckedChange={(checked) =>
                    setUnderstandLoss(checked === true)
                  }
                />
                <label
                  htmlFor="understand-loss"
                  className="cursor-pointer select-none text-sm leading-tight"
                >
                  I understand that losing this phrase means permanent loss of
                  access to my files
                </label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="ready-to-save"
                  checked={readyToSave}
                  onCheckedChange={(checked) =>
                    setReadyToSave(checked === true)
                  }
                />
                <label
                  htmlFor="ready-to-save"
                  className="cursor-pointer select-none text-sm leading-tight"
                >
                  I am ready to save the recovery phrase now
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGenerateWarning(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateKey}
              disabled={!understandLoss || !readyToSave || isGenerating}
            >
              Create encryption key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl tracking-tight">Recovery & Access</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage the browser access that protects your encrypted vault.
            Recovery happens locally; your phrase and file key are not sent to
            the ZeroDrive server.
          </p>
        </div>

        {!generatedMnemonic && (
          <div
            className="grid grid-cols-2 border"
            role="tablist"
            aria-label="Key management mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "recover"}
              onClick={() => switchMode("recover")}
              className={`flex items-center justify-center gap-2 border-r px-4 py-3 text-sm font-medium ${
                mode === "recover" ? "bg-muted/60" : "hover:bg-muted/30"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Recover existing key
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "generate"}
              onClick={() => switchMode("generate")}
              className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                mode === "generate" ? "bg-muted/60" : "hover:bg-muted/30"
              }`}
            >
              <FileKey className="h-4 w-4" />
              Create new key
            </button>
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
          {mode === "recover" ? renderRecovery() : renderGeneration()}
          <DeviceManagement refreshKey={keyStatusVersion} />
        </div>
      </div>
    </>
  );
};
