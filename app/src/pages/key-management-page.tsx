import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateMnemonic,
  deriveKeyFromMnemonic,
  storeKey,
} from "../utils/cryptoUtils";
import { testEncryptionKey } from "../utils/keyTest";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import React from "react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Textarea } from "../components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { BackupVerification } from "../components/key-management/BackupVerification";
import { Checkbox } from "../components/ui/checkbox";
import { DeviceManagement } from "../components/key-management/DeviceManagement";

export const KeyManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(
    null
  );
  const [inputMnemonic, setInputMnemonic] = useState<string>("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [viewMode, setViewMode] = useState<"recover" | "generate">("recover");
  const [isTesting, setIsTesting] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasWrittenDown, setHasWrittenDown] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleGenerateNewMnemonicAndKey = async () => {
    setError("");
    setGeneratedMnemonic(null);
    try {
      const newMnemonic = generateMnemonic();
      setGeneratedMnemonic(newMnemonic);
      const key = await deriveKeyFromMnemonic(newMnemonic);
      await storeKey(key);
      toast.success("New Mnemonic & Key Generated!", {
        description:
          "Your new mnemonic phrase is displayed below. PLEASE SAVE IT SECURELY. It is the only way to recover your key.",
        duration: 10000,
      });
    } catch (err) {
      console.error("Error generating new mnemonic and key:", err);
      setError("Failed to generate new mnemonic and key. Please try again.");
      toast.error("Key Generation Failed", {
        description: "Could not generate a new mnemonic and key.",
      });
    }
  };

  const handleLoadKeyFromMnemonic = async () => {
    setError("");
    if (!inputMnemonic.trim()) {
      setError("Please enter your mnemonic phrase.");
      return;
    }
    try {
      const key = await deriveKeyFromMnemonic(inputMnemonic.trim());
      await storeKey(key);
      toast.success("Key Loaded Successfully!", {
        description: "Your encryption key has been loaded from the mnemonic.",
      });
      // Navigate to storage instead of reloading
      setTimeout(() => {
        navigate("/storage");
      }, 1500);
    } catch (err) {
      console.error("Error loading key from mnemonic:", err);
      setError(
        "Failed to load key from mnemonic. Ensure the phrase is correct or try generating a new key if this is your first time."
      );
      toast.error("Key Load Failed", {
        description: "Invalid mnemonic phrase or an unexpected error occurred.",
      });
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError("");
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const keyJWK = JSON.parse(e.target?.result as string);
          if (
            !keyJWK.kty ||
            keyJWK.kty !== "oct" ||
            !keyJWK.k ||
            !keyJWK.alg ||
            keyJWK.alg !== "A256GCM"
          ) {
            throw new Error("Invalid key format in JSON file.");
          }
          const key = await crypto.subtle.importKey(
            "jwk",
            keyJWK,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
          );
          await storeKey(key);
          toast.success("Encryption key added from file!", {
            description: "Your encryption key has been added to storage.",
          });
          // Navigate to storage instead of reloading
          setTimeout(() => {
            navigate("/storage");
          }, 1500);
        } catch (error) {
          console.error("Error processing key file:", error);
          setError(
            "Invalid key file. Please ensure the file contains a valid AES-GCM key in JSON format."
          );
          toast.error("Invalid Key File", {
            description: "The uploaded file does not contain a valid key.",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const switchToGenerate = () => {
    setError("");
    setInputMnemonic("");
    setGeneratedMnemonic(null);
    setHasDownloaded(false);
    setHasWrittenDown(false);
    setIsVerified(false);
    setViewMode("generate");
  };

  const switchToRecover = () => {
    setError("");
    setInputMnemonic("");
    setGeneratedMnemonic(null);
    setHasDownloaded(false);
    setHasWrittenDown(false);
    setIsVerified(false);
    setViewMode("recover");
  };

  const handleDownloadMnemonic = () => {
    if (!generatedMnemonic) return;

    const blob = new Blob([generatedMnemonic], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zerodrive-mnemonic.txt";
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
    toast.info("Mnemonic downloaded as zerodrive-mnemonic.txt");
  };

  const handleVerificationComplete = () => {
    setIsVerified(true);
    toast.success("Backup verified!", {
      description: "You can now safely use your encryption key.",
      duration: 3000,
    });
    setTimeout(() => {
      navigate("/storage");
    }, 2000);
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    try {
      const result = await testEncryptionKey();

      if (result.success) {
        toast.success(result.message, {
          description: "Your key is working correctly and ready to use.",
          duration: 5000,
        });
      } else {
        toast.error(result.message, {
          description: "Please regenerate your key or check your backup.",
          duration: 7000,
        });
      }
    } catch (error) {
      toast.error("Test failed", {
        description: "An unexpected error occurred while testing your key.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background py-8">
      <Card className="sm:max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>
              {viewMode === "recover" ? "Recover Your Key" : "Create New Key"}
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/storage")}
              aria-label="Back to Storage"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {viewMode === "recover"
              ? "Enter your mnemonic phrase to load your encryption key."
              : "Generate a new secure mnemonic phrase to create your encryption key. Save it securely!"}
          </CardDescription>
        </CardHeader>

        {viewMode === "recover" && (
          <>
            <CardContent className="grid gap-4">
              <div className="grid gap-3">
                <Textarea
                  id="mnemonicInput"
                  placeholder="Enter your 12 or 24 word mnemonic phrase here..."
                  value={inputMnemonic}
                  onChange={(e) => setInputMnemonic(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleLoadKeyFromMnemonic}
                  disabled={!inputMnemonic.trim()}
                >
                  Load Key from Mnemonic
                </Button>
              </div>
              <Button
                variant="link"
                onClick={switchToGenerate}
                className="p-0 h-auto text-sm self-start"
              >
                Don't have a key? Create new secure mnemonic.
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFileUpload(!showFileUpload)}
              >
                {showFileUpload
                  ? "Hide File Upload"
                  : "Advanced: Use Existing Key File (.json)"}
              </Button>
              {showFileUpload && (
                <div className="w-full pt-4 grid gap-3">
                  <CardDescription>
                    If you have an existing encryption key file
                    (`encryption-key.json`), you can upload it here.
                  </CardDescription>
                  <Label className="block text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input cursor-pointer p-2 text-center rounded-md">
                    <span>Upload your encryption key file</span>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </Label>
                </div>
              )}
            </CardFooter>
          </>
        )}

        {viewMode === "generate" && (
          <CardContent className="grid gap-4">
            <Button
              onClick={handleGenerateNewMnemonicAndKey}
              disabled={!!generatedMnemonic}
            >
              {generatedMnemonic
                ? "Mnemonic Generated!"
                : "Generate New Secure Mnemonic & Key"}
            </Button>
            {generatedMnemonic && (
              <>
                <div className="mt-3 p-3 border rounded-md bg-muted space-y-3">
                  <div>
                    <p className="text-sm text-destructive font-semibold mb-1">
                      IMPORTANT: Save this mnemonic phrase in a safe place. Do not
                      share it.
                    </p>
                    <Textarea
                      readOnly
                      value={generatedMnemonic}
                      rows={3}
                      className="font-mono text-sm select-all"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This phrase is the ONLY way to recover your encryption key.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadMnemonic}
                      variant="secondary"
                      size="sm"
                    >
                      Download Mnemonic (.txt)
                    </Button>
                    <Button
                      onClick={handleTestKey}
                      variant="outline"
                      size="sm"
                      disabled={isTesting}
                    >
                      {isTesting ? "Testing..." : "Test Your Key"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-4 border-2 border-orange-500/50 rounded-md bg-orange-50 dark:bg-orange-950/20 space-y-3">
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                    Please confirm you have saved your mnemonic:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="downloaded"
                        checked={hasDownloaded}
                        onCheckedChange={(checked) => setHasDownloaded(checked === true)}
                      />
                      <label
                        htmlFor="downloaded"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        I have downloaded the mnemonic file or written it down in a secure location
                      </label>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="written"
                        checked={hasWrittenDown}
                        onCheckedChange={(checked) => setHasWrittenDown(checked === true)}
                      />
                      <label
                        htmlFor="written"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        I understand that losing this phrase means permanent loss of access to my encrypted files
                      </label>
                    </div>
                  </div>
                </div>

                {hasDownloaded && hasWrittenDown && !isVerified && (
                  <BackupVerification
                    mnemonic={generatedMnemonic}
                    onVerified={handleVerificationComplete}
                  />
                )}

                {isVerified && (
                  <div className="mt-4 p-4 border-2 border-green-500 rounded-md bg-green-50 dark:bg-green-950/20">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100 text-center">
                      ✅ Your backup has been verified! Redirecting to storage...
                    </p>
                  </div>
                )}
              </>
            )}
            <Button
              variant="link"
              onClick={switchToRecover}
              className="p-0 h-auto text-sm self-start mt-2"
            >
              Already have a key? Enter your mnemonic.
            </Button>
          </CardContent>
        )}

        {error && (
          <CardContent>
            <p className="text-red-500 text-sm font-medium p-3 bg-destructive/10 rounded-md mt-4">
              {error}
            </p>
          </CardContent>
        )}
      </Card>

      <div className="sm:max-w-lg w-full">
        <DeviceManagement />
      </div>
    </div>
  );
};
