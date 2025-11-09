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
  fetchUserPublicKey,
} from "../utils/fileSharing";
import apiClient from "../utils/apiClient";
import {
  storeUserKeyPair,
  userHasStoredKeys,
  getUserKeyPair,
  deleteUserKeyPair,
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
  const [customMessage, setCustomMessage] = useState<string>("");
  const [senderEmail, setSenderEmail] = useState<string>("");
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [hasGeneratedKeys, setHasGeneratedKeys] = useState<boolean>(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState<boolean>(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState<boolean>(true);
  const [recipientKeyMissing, setRecipientKeyMissing] =
    useState<boolean>(false);
  const [isSendingInvitation, setIsSendingInvitation] =
    useState<boolean>(false);

  // Rollback function to clean up keys if backup fails
  const rollbackKeyGeneration = async (email: string) => {
    try {
      console.log('Rolling back key generation for:', email);

      // 1. Delete from IndexedDB
      await deleteUserKeyPair(email);

      // 2. Delete from PostgreSQL
      const hashedEmail = await hashEmail(email);
      await apiClient.publicKeys.delete(hashedEmail);

      console.log('Rollback completed: keys deleted from all storage locations');
    } catch (error) {
      console.error('Error during rollback:', error);
    }
  };

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
            // Auto-repair: Check if public key exists in PostgreSQL
            const hashedEmail = await hashEmail(senderEmail);
            try {
              const serverKey = await fetchUserPublicKey(hashedEmail);

              if (!serverKey) {
                // Public key missing from server - auto-upload from IndexedDB
                console.log(
                  "Public key missing from server, syncing from local storage..."
                );
                const localKeyPair = await getUserKeyPair(senderEmail);
                if (localKeyPair?.publicKeyJwk) {
                  await storeUserPublicKey(
                    hashedEmail,
                    localKeyPair.publicKeyJwk
                  );
                  toast.success(
                    "Sharing keys loaded from local storage and synced to server."
                  );
                } else {
                  toast.success("Sharing keys loaded from local storage.");
                }
              } else {
                toast.success("Sharing keys loaded from local storage.");
              }
            } catch (syncError) {
              console.error("Error syncing public key to server:", syncError);
              // Still mark as loaded since keys exist locally
              toast.success("Sharing keys loaded from local storage.");
            }

            setHasGeneratedKeys(true);
            keysSuccessfullyLoaded = true;
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
    const genToastId = toast.loading("Performing preflight checks...");

    try {
      // 1. Check Google Drive authentication FIRST
      const authInstance = gapi.auth2?.getAuthInstance();
      if (!authInstance || !authInstance.isSignedIn.get()) {
        toast.error('Google Drive not authenticated', {
          description: 'Backup is required for file sharing. Please ensure you are signed in.',
          id: genToastId
        });
        setIsGeneratingKeys(false);
        return;
      }

      // 2. Check for primary encryption key
      toast.loading("Checking for primary encryption key...", { id: genToastId });
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

      // 3. Generate RSA keys
      toast.loading("Generating your sharing keys...", { id: genToastId });
      const keyPair = await generateUserKeyPair();
      const hashedEmail = await hashEmail(senderEmail);

      // 4. Store keys locally (IndexedDB and PostgreSQL)
      await storeUserPublicKey(hashedEmail, keyPair.publicKeyJwk);
      await storeUserKeyPair(senderEmail, keyPair);

      // 5. Backup to Google Drive (MANDATORY)
      if (keyPair.privateKeyJwk) {
        toast.loading("Backing up to Google Drive (required)...", {
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

          if (!uploadFileId) {
            throw new Error('Google Drive upload returned null');
          }

          // ✅ SUCCESS - Everything worked!
          setHasGeneratedKeys(true);
          toast.success('Sharing keys generated and backed up to Drive', {
            id: genToastId
          });

        } catch (backupError) {
          // ❌ BACKUP FAILED - Rollback everything
          console.error('Backup failed, rolling back:', backupError);

          toast.loading('Backup failed - cleaning up...', { id: genToastId });

          await rollbackKeyGeneration(senderEmail);

          toast.error('Key generation cancelled due to backup failure', {
            description: backupError instanceof Error
              ? backupError.message
              : 'Could not backup to Google Drive. Please check connection and try again.',
            id: genToastId,
            duration: 8000
          });

          setIsGeneratingKeys(false);
          return; // Stop here - don't continue
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
    setRecipientKeyMissing(false); // Reset state
    const sharingToastId = toast.loading(`Preparing to share ${file.name}...`);
    try {
      const preparation = await prepareFileForSharing(
        file,
        recipientEmail,
        senderEmail,
        customMessage || undefined
      );
      const shareId = crypto.randomUUID();
      await storeFileShare(shareId, "encrypted-share", preparation);
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

      // Check if error is due to missing recipient key
      if (
        error instanceof Error &&
        (error.message.includes("has not registered their public key") ||
          (error.message.includes("Recipient") &&
            error.message.includes("not registered")))
      ) {
        setRecipientKeyMissing(true);
        toast.error("Recipient has not set up file sharing", {
          description: `${recipientEmail} hasn't registered their public key yet. You can send them an invitation below.`,
          id: sharingToastId,
          duration: 6000,
        });
      } else {
        toast.error("Failed to share file", {
          description: error instanceof Error ? error.message : "Unknown error",
          id: sharingToastId,
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!recipientEmail) {
      toast.error("Please enter recipient's email");
      return;
    }

    setIsSendingInvitation(true);
    const inviteToastId = toast.loading(
      `Sending invitation to ${recipientEmail}...`
    );

    try {
      const result = await apiClient.invitations.send({
        recipient_email: recipientEmail,
        sender_message: customMessage || undefined,
      });

      toast.success("Invitation sent successfully!", {
        description: `${recipientEmail} has been invited to join ZeroDrive. ${result.remaining} invitations remaining this hour.`,
        id: inviteToastId,
      });

      setRecipientKeyMissing(false); // Hide invitation card after sending
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation", {
        description: error instanceof Error ? error.message : "Unknown error",
        id: inviteToastId,
      });
    } finally {
      setIsSendingInvitation(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex justify-center items-center bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/storage")}
            aria-label="Back to Storage"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card: Main File Sharing */}
          <Card>
            <CardHeader>
              <CardTitle>File Sharing</CardTitle>
              <CardDescription>
                Upload and share your encrypted files
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
                      Generate your unique RSA key pair for securely sharing
                      files. If you have set up your main ZeroDrive encryption
                      key (via Key Management), your sharing private key will be
                      automatically backed up to your Google Drive (hidden
                      appData folder), encrypted with that main key.
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
                    If your main key isn't set up, sharing keys will be
                    generated for local use only, and backup will be skipped.
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

          {/* Right Card: Custom Message */}
          <Card>
            <CardHeader>
              <CardTitle>Personalize Email</CardTitle>
              <CardDescription>
                Add a custom message to your notification email (optional)
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="custom-message">Your Message</Label>
                <textarea
                  id="custom-message"
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                  placeholder="Hey! I'm sharing this file with you. Check it out when you get a chance!"
                  value={customMessage}
                  onChange={(e) =>
                    setCustomMessage(e.target.value.slice(0, 500))
                  }
                  disabled={isSharing || !hasGeneratedKeys}
                  maxLength={500}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {customMessage.length}/500 characters
                  </p>
                  {customMessage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomMessage("")}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="text-xs font-medium mb-2">📧 Email Preview</p>
                <p className="text-xs text-muted-foreground italic">
                  {customMessage ||
                    "Someone has shared a file with you on ZeroDrive, a secure zero-knowledge file sharing platform."}
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  💡 <strong>Tip:</strong> Your identity remains private. The
                  recipient will not see your name or email address.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Invitation Alert - Shows when recipient key is missing */}
          {recipientKeyMissing && (
            <div className="col-span-1 lg:col-span-2">
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
                <CardHeader>
                  <CardTitle className="text-amber-800 dark:text-amber-300">
                    📨 Recipient Not Set Up
                  </CardTitle>
                  <CardDescription className="text-amber-700 dark:text-amber-400">
                    {recipientEmail} hasn't registered their public key yet.
                    Send them an invitation to join ZeroDrive!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Your invitation will include:
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc list-inside space-y-1 ml-2">
                    <li>A link to sign up for ZeroDrive</li>
                    <li>Instructions to enable file sharing</li>
                    {customMessage && <li>Your personal message</li>}
                  </ul>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSendInvitation}
                      disabled={isSendingInvitation || !recipientEmail}
                      className="flex-1"
                    >
                      {isSendingInvitation ? "Sending..." : "Send Invitation"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRecipientKeyMissing(false)}
                      disabled={isSendingInvitation}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareFilesPage;
