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
import { ArrowLeft, AlertCircle } from "lucide-react";
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
  const [showGenerateWarning, setShowGenerateWarning] = useState(false);
  const [understandLoss, setUnderstandLoss] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);

  const handleShowWarning = () => {
    setShowGenerateWarning(true);
    setUnderstandLoss(false);
    setReadyToSave(false);
  };

  const handleGenerateNewMnemonicAndKey = async () => {
    setShowGenerateWarning(false);
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
    setViewMode("generate");
  };

  const switchToRecover = () => {
    setError("");
    setInputMnemonic("");
    setGeneratedMnemonic(null);
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
    toast.info("Mnemonic downloaded as zerodrive-mnemonic.txt");
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
    <>
      {/* Warning Dialog - Shown before generating mnemonic */}
      <Dialog open={showGenerateWarning} onOpenChange={setShowGenerateWarning}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              IMPORTANT: Read Before Generating Key
            </DialogTitle>
            <DialogDescription>
              Please understand the consequences before proceeding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Main Warning */}
            <div className="p-4 border-2 border-destructive rounded-md bg-destructive/10">
              <p className="text-sm font-bold text-destructive mb-2">
                ⚠️ Your Files Will Be PERMANENTLY Lost if You Lose This Key
              </p>
              <p className="text-sm text-muted-foreground">
                Unlike a password, we <strong>CANNOT</strong> reset or recover
                your encryption key. If you lose it, your files are{" "}
                <strong>gone forever</strong>.
              </p>
            </div>

            {/* What to Expect */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Before you continue:</p>
              <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                <li>You will receive a 12-word backup phrase</li>
                <li>
                  You <strong>MUST</strong> write it down or download it
                </li>
                <li>Keep it somewhere safe (password manager, safe, etc.)</li>
                <li>
                  <strong>NEVER</strong> share it with anyone
                </li>
              </ul>
            </div>

            {/* Confirmation Checkboxes */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understand-loss"
                  checked={understandLoss}
                  onCheckedChange={(checked) =>
                    setUnderstandLoss(checked === true)
                  }
                />
                <label
                  htmlFor="understand-loss"
                  className="text-sm leading-tight cursor-pointer select-none"
                >
                  I understand that losing my backup phrase means permanent loss
                  of <strong>ALL</strong> my files
                </label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ready-to-save"
                  checked={readyToSave}
                  onCheckedChange={(checked) =>
                    setReadyToSave(checked === true)
                  }
                />
                <label
                  htmlFor="ready-to-save"
                  className="text-sm leading-tight cursor-pointer select-none"
                >
                  I am prepared to save my backup phrase securely right now
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGenerateWarning(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateNewMnemonicAndKey}
              disabled={!understandLoss || !readyToSave}
              className="w-full sm:w-auto"
            >
              I Understand, Generate My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-center items-center min-h-screen bg-background py-8">
        <div className="flex gap-5">
          <Card className="sm:max-w-lg w-full h-fit">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>
                  {viewMode === "recover"
                    ? "Recover Your Key"
                    : "Create New Key"}
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
                  onClick={handleShowWarning}
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
                          IMPORTANT: Save this mnemonic phrase in a safe place.
                          Do not share it.
                        </p>
                        <Textarea
                          readOnly
                          value={generatedMnemonic}
                          rows={3}
                          className="font-mono text-sm select-all"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This phrase is the ONLY way to recover your encryption
                          key.
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

          <DeviceManagement />
        </div>
      </div>
    </>
  );
};
