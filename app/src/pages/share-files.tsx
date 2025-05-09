import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ArrowLeft } from "lucide-react";
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
  prepareFileForSharing,
  storeFileShare,
  generateUserKeyPair,
  storeUserPublicKey,
  hashEmail,
  UserKeyPair,
} from "../utils/fileSharing";
import {
  storeUserKeyPair,
  userHasStoredKeys,
  getUserKeyPair,
} from "../utils/keyStorage";
import {
  encryptRsaPrivateKeyWithAesKey,
  decryptRsaPrivateKeyWithAesKey,
} from "../utils/rsaKeyManager";
import {
  uploadEncryptedRsaKeyToDrive,
  downloadEncryptedRsaKeyFromDrive,
} from "../utils/gdriveKeyStorage";
import { getStoredKey } from "../utils/cryptoUtils";

const ShareFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [senderEmail, setSenderEmail] = useState<string>("");
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [hasGeneratedKeys, setHasGeneratedKeys] = useState<boolean>(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState<boolean>(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState<boolean>(true);

  useEffect(() => {
    const initializeAndCheckKeys = async () => {
      if (!senderEmail) return;

      setIsCheckingKeys(true);
      let keysSuccessfullyLoaded = false;
      const recoveryToastId = toast.loading(
        "Checking for key backup in Google Drive..."
      );
      let encryptedKeyBlob: Blob | null = null;

      try {
        encryptedKeyBlob = await downloadEncryptedRsaKeyFromDrive();

        if (encryptedKeyBlob) {
          toast.loading(
            "Backup found. Attempting to decrypt with your primary key...",
            { id: recoveryToastId }
          );
          const primaryAesKey = await getStoredKey();

          if (primaryAesKey) {
            try {
              const privateKeyJwk = await decryptRsaPrivateKeyWithAesKey(
                encryptedKeyBlob,
                primaryAesKey
              );

              // Construct publicKeyJwk from privateKeyJwk
              // RSA private JWK contains public components (n, e, alg, kty, key_ops etc.)
              // We need to ensure key_ops for public key is "encrypt"
              const publicKeyJwk: JsonWebKey = {
                kty: privateKeyJwk.kty,
                n: privateKeyJwk.n,
                e: privateKeyJwk.e,
                alg: privateKeyJwk.alg
                  ? privateKeyJwk.alg.replace("PS", "RS")
                  : "RSA-OAEP-256", // Or determine alg based on private
                key_ops: ["encrypt"],
                ext: true, // Typically true for public keys
              };

              // Validate essential components for a public key
              if (!publicKeyJwk.n || !publicKeyJwk.e || !publicKeyJwk.kty) {
                throw new Error(
                  "Failed to reconstruct public key from private key backup."
                );
              }

              // Ensure the private key also has the correct key_ops if not already set
              if (!privateKeyJwk.key_ops) {
                privateKeyJwk.key_ops = ["decrypt"];
              }

              const recoveredKeyPair: UserKeyPair = {
                publicKeyJwk,
                privateKeyJwk,
              };

              await storeUserKeyPair(senderEmail, recoveredKeyPair);
              const hashedEmail = await hashEmail(senderEmail);
              await storeUserPublicKey(
                hashedEmail,
                recoveredKeyPair.publicKeyJwk
              );

              setHasGeneratedKeys(true);
              keysSuccessfullyLoaded = true;
              toast.success(
                "Sharing keys successfully recovered from Google Drive backup and loaded.",
                { id: recoveryToastId }
              );
            } catch (decryptionError) {
              console.error("Failed to decrypt key backup:", decryptionError);
              toast.error("Failed to decrypt key backup from Google Drive.", {
                description:
                  decryptionError instanceof Error
                    ? decryptionError.message
                    : "The primary key might be incorrect or backup corrupted.",
                id: recoveryToastId,
              });
            }
          } else {
            toast.warning(
              "Primary encryption key not found in local storage.",
              {
                description:
                  "Cannot decrypt Google Drive backup. Please set up your main key in Key Management or generate new sharing keys.",
                id: recoveryToastId,
                duration: 7000,
              }
            );
          }
        } else {
          toast.info(
            "No key backup found in Google Drive. Checking local storage...",
            { id: recoveryToastId }
          );
        }
      } catch (driveError) {
        console.error(
          "Error checking Google Drive for key backup:",
          driveError
        );
        toast.error("Could not check Google Drive for key backup.", {
          description:
            driveError instanceof Error
              ? driveError.message
              : "Please check your connection.",
          id: recoveryToastId,
        });
      }

      if (!keysSuccessfullyLoaded) {
        // Fallback to checking IndexedDB if Drive recovery failed or no backup
        try {
          toast.dismiss(recoveryToastId); // Dismiss previous toast if any
          const hasLocalKeys = await userHasStoredKeys(senderEmail);
          if (hasLocalKeys) {
            setHasGeneratedKeys(true);
            keysSuccessfullyLoaded = true;
            toast.success("Sharing keys loaded from local storage.");
          } else if (!encryptedKeyBlob) {
            // Only show this if no Drive backup was attempted or found
            toast.info("No sharing keys found locally. Please generate them.");
          }
        } catch (localCheckError) {
          console.error(
            "Error checking local storage for keys:",
            localCheckError
          );
          toast.error("Failed to check for local sharing keys.");
        }
      }

      if (!keysSuccessfullyLoaded) {
        // This final check ensures that if neither Drive nor local keys were loaded,
        // the state reflects that, and the user will be prompted to generate.
        setHasGeneratedKeys(false);
      }

      setIsCheckingKeys(false);
    };

    if (senderEmail) initializeAndCheckKeys();
  }, [senderEmail, navigate]);

  useEffect(() => {
    const getUserEmail = () => {
      try {
        const authInstance = gapi.auth2?.getAuthInstance();
        if (authInstance && authInstance.isSignedIn.get()) {
          const profile = authInstance.currentUser.get().getBasicProfile();
          if (profile) {
            setSenderEmail(profile.getEmail());
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleRecipientEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRecipientEmail(e.target.value);
  };

  const handleGenerateKeys = async () => {
    if (!senderEmail) {
      toast.error("User email not available. Cannot generate keys.");
      return;
    }

    setIsGeneratingKeys(true);
    const genToastId = toast.loading("Checking for primary encryption key...");

    try {
      const primaryAesKey = await getStoredKey();

      if (!primaryAesKey) {
        toast.info("Redirecting to Key Management page...", {
          id: genToastId,
          description: "You need to set up your main encryption key first.",
        });
        setIsGeneratingKeys(false);
        navigate("/key-management");
        return;
      }

      toast.loading("Generating your sharing keys...", { id: genToastId });

      const keyPair = await generateUserKeyPair();
      const hashedEmail = await hashEmail(senderEmail);
      await storeUserPublicKey(hashedEmail, keyPair.publicKeyJwk);
      await storeUserKeyPair(senderEmail, keyPair);

      toast.success(
        "Sharing keys generated and public key registered locally.",
        { id: genToastId }
      );
      setHasGeneratedKeys(true);

      if (keyPair.privateKeyJwk) {
        toast.loading("Backing up sharing private key to Google Drive...", {
          id: genToastId,
        });
        try {
          const encryptedPrivateKeyBlob = await encryptRsaPrivateKeyWithAesKey(
            keyPair.privateKeyJwk,
            primaryAesKey
          );

          console.log(
            "Encrypted private key blob for backup (using primary AES key):",
            encryptedPrivateKeyBlob
          );

          const uploadFileId = await uploadEncryptedRsaKeyToDrive(
            encryptedPrivateKeyBlob
          );

          if (uploadFileId) {
            toast.success(`Sharing private key backed up to Google Drive `);
          } else {
            toast.error(
              "Failed to back up sharing private key to Google Drive.",
              {
                description:
                  "Please check console for errors. Your keys are generated locally, but backup failed.",
                id: genToastId,
                duration: 10000,
              }
            );
          }
        } catch (backupError) {
          console.error(
            "Failed to encrypt or backup sharing private key:",
            backupError
          );
          toast.error(
            "Keys generated locally, but failed to prepare/backup sharing private key.",
            {
              description:
                backupError instanceof Error
                  ? backupError.message
                  : "Unknown error during backup.",
              id: genToastId,
              duration: 10000,
            }
          );
        }
      }
    } catch (error) {
      console.error("Error during sharing key generation process:", error);
      let errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      let description = "";
      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("connect")
      ) {
        description = "Network or Supabase connection issue.";
      }
      toast.error("Failed to generate sharing keys", {
        description: description || errorMessage,
        id: genToastId,
      });
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handleShareFile = async () => {
    if (!file) {
      toast.error("Please select a file to share");
      return;
    }
    if (!recipientEmail) {
      toast.error("Please enter recipient's email");
      return;
    }
    if (!senderEmail) {
      toast.error("Your email could not be determined");
      return;
    }
    if (!hasGeneratedKeys) {
      toast.error(
        "You need to generate your sharing keys first. Click the button above."
      );
      return;
    }

    setIsSharing(true);
    const sharingToastId = toast.loading(`Preparing to share ${file.name}...`);
    try {
      const preparation = await prepareFileForSharing(
        file,
        recipientEmail,
        senderEmail
      );
      const shareId = crypto.randomUUID();
      await storeFileShare(shareId, "zk-share-file", preparation);
      toast.success(
        `File "${file.name}" has been prepared for sharing with ${recipientEmail}`,
        { id: sharingToastId }
      );
      setFile(null);
      setRecipientEmail("");
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error sharing file:", error);
      toast.error("Failed to share file", {
        description: error instanceof Error ? error.message : "Unknown error",
        id: sharingToastId,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Share Files Securely</CardTitle>
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
            Generate your unique sharing keys once, then share encrypted files.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isCheckingKeys ? (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Checking key status...
              </p>
            </div>
          ) : !hasGeneratedKeys ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800 space-y-3">
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Setup Sharing Keys
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Generate your unique RSA key pair for securely sharing files.
                  If you have set up your main ZeroDrive encryption key (via Key
                  Management), your sharing private key will be automatically
                  backed up to your Google Drive (hidden appData folder),
                  encrypted with that main key.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleGenerateKeys}
                disabled={isGeneratingKeys || !senderEmail}
                className="w-full"
              >
                {isGeneratingKeys
                  ? "Processing..."
                  : "Generate Sharing Keys & Backup to Drive"}
              </Button>
              <p className="text-xs text-muted-foreground pt-1">
                If your main key isn't set up, sharing keys will be generated
                for local use only, and backup will be skipped.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                Sharing Keys Active
              </h3>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                You can now select a file and recipient to share securely.
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="file-input">File to Share</Label>
            <Input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              disabled={isSharing || !hasGeneratedKeys}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="recipient-email">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="recipient@example.com"
              value={recipientEmail}
              onChange={handleRecipientEmailChange}
              disabled={isSharing || !hasGeneratedKeys}
            />
            <p className="text-xs text-muted-foreground">
              The recipient must have also generated their sharing keys.
            </p>
          </div>

          <Button
            className="w-full mt-2"
            onClick={handleShareFile}
            disabled={
              !file ||
              !recipientEmail ||
              isSharing ||
              !senderEmail ||
              !hasGeneratedKeys
            }
          >
            {isSharing ? "Preparing Share..." : "Share Encrypted File"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShareFilesPage;
