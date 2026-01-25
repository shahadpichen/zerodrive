import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { gapi } from "gapi-script";
import { toast } from "sonner";
import { useApp } from "../contexts/app-context";
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
  fetchUserPublicKey,
} from "../utils/fileSharing";
import apiClient from "../utils/apiClient";
import {
  storeUserKeyPair,
  getUserKeyPair,
  deleteUserKeyPair,
} from "../utils/keyStorage";
import { encryptRsaPrivateKeyWithAesKey } from "../utils/rsaKeyManager";
import { uploadEncryptedRsaKeyToDrive } from "../utils/gdriveKeyStorage";
import { getStoredKey } from "../utils/cryptoUtils";
import { getMnemonic } from "../utils/mnemonicManager";
import { recoverRsaKeysIfNeeded } from "../utils/rsaKeyRecovery";

const ShareFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { creditBalance, isLoadingCredits, refreshCredits } = useApp();

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
  const [mnemonicInput, setMnemonicInput] = useState<string>("");
  const [showMnemonicInput, setShowMnemonicInput] = useState<boolean>(false);
  const [isVerifyingMnemonic, setIsVerifyingMnemonic] =
    useState<boolean>(false);
  const [mnemonicVerified, setMnemonicVerified] = useState<boolean>(false);

  // Rollback function to clean up keys if backup fails
  const rollbackKeyGeneration = async (email: string) => {
    try {
      console.log("Rolling back key generation for:", email);

      // 1. Delete from IndexedDB
      await deleteUserKeyPair(email);

      // 2. Delete from PostgreSQL
      const hashedEmail = await hashEmail(email);
      await apiClient.publicKeys.delete(hashedEmail);

      console.log(
        "Rollback completed: keys deleted from all storage locations"
      );
    } catch (error) {
      console.error("Error during rollback:", error);
    }
  };

  useEffect(() => {
    const initializeAndCheckKeys = async () => {
      if (!senderEmail) return;

      setIsCheckingKeys(true);

      try {
        // Use centralized recovery utility
        const result = await recoverRsaKeysIfNeeded(senderEmail, false);

        if (result.keysExisted || result.recovered) {
          // Keys exist or were successfully recovered
          setHasGeneratedKeys(true);

          // Auto-repair: Ensure public key is synced to server
          if (result.keysExisted) {
            const hashedEmail = await hashEmail(senderEmail);
            try {
              const serverKey = await fetchUserPublicKey(hashedEmail);
              if (!serverKey) {
                const mnemonic = getMnemonic();
                if (mnemonic) {
                  const localKeyPair = await getUserKeyPair(
                    senderEmail,
                    mnemonic
                  );
                  if (localKeyPair?.publicKeyJwk) {
                    await storeUserPublicKey(
                      hashedEmail,
                      localKeyPair.publicKeyJwk
                    );
                    console.log("Public key synced to server");
                  }
                }
              }
            } catch (syncError) {
              console.error("Error syncing public key to server:", syncError);
            }
          }
        } else {
          // No keys found (user hasn't enabled sharing yet)
          setHasGeneratedKeys(false);
        }
      } catch (error) {
        console.error("Error during key initialization:", error);
        setHasGeneratedKeys(false);
      } finally {
        setIsCheckingKeys(false);
      }
    };

    if (senderEmail) initializeAndCheckKeys();
  }, [senderEmail, navigate]);

  useEffect(() => {
    const getUserEmail = async () => {
      try {
        // Use authService to get email (more reliable than GAPI)
        const { getUserEmail: getEmail } = await import("../utils/authService");
        const email = await getEmail();

        if (email) {
          setSenderEmail(email);
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

  // Check if mnemonic exists in memory
  useEffect(() => {
    if (hasGeneratedKeys) {
      const mnemonic = getMnemonic();
      if (!mnemonic) {
        // Keys exist but mnemonic not in memory - show input
        setShowMnemonicInput(true);
        setMnemonicVerified(false);
      } else {
        // Mnemonic in memory - no need for input
        setShowMnemonicInput(false);
        setMnemonicVerified(true);
      }
    }
  }, [hasGeneratedKeys]);

  // Credit balance is now managed by AppContext - no need to fetch locally

  // Verify mnemonic function - only for decryption, NOT stored in memory
  const verifyMnemonic = async () => {
    if (!mnemonicInput || !senderEmail) return;

    setIsVerifyingMnemonic(true);
    try {
      // Try to decrypt keys with mnemonic
      const keyPair = await getUserKeyPair(senderEmail, mnemonicInput);
      if (keyPair) {
        setMnemonicVerified(true);
        setShowMnemonicInput(false);
        toast.success("Mnemonic verified - you can now share files");
      } else {
        toast.error("Invalid mnemonic or keys not found");
      }
    } catch (error) {
      console.error("Mnemonic verification failed:", error);
      toast.error("Invalid mnemonic - cannot decrypt keys");
    } finally {
      setIsVerifyingMnemonic(false);
    }
  };

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
        toast.error("Google Drive not authenticated", {
          description:
            "Backup is required for file sharing. Please ensure you are signed in.",
          id: genToastId,
        });
        setIsGeneratingKeys(false);
        return;
      }

      // 2. Check for primary encryption key
      toast.loading("Checking for primary encryption key...", {
        id: genToastId,
      });
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

      // Get mnemonic from memory (user must have come from /key-management)
      const mnemonic = getMnemonic();
      if (!mnemonic) {
        throw new Error('Mnemonic not found - cannot encrypt RSA private key');
      }
      await storeUserKeyPair(senderEmail, keyPair, mnemonic);

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
            throw new Error("Google Drive upload returned null");
          }

          // ✅ SUCCESS - Everything worked!
          setHasGeneratedKeys(true);
          toast.success("Sharing keys generated and backed up to Drive", {
            id: genToastId,
          });
        } catch (backupError) {
          // ❌ BACKUP FAILED - Rollback everything
          console.error("Backup failed, rolling back:", backupError);

          toast.loading("Backup failed - cleaning up...", { id: genToastId });

          await rollbackKeyGeneration(senderEmail);

          toast.error("Key generation cancelled due to backup failure", {
            description:
              backupError instanceof Error
                ? backupError.message
                : "Could not backup to Google Drive. Please check connection and try again.",
            id: genToastId,
            duration: 8000,
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
        description = "Network connection issue.";
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

    // Get mnemonic from memory or from input field
    const mnemonic = getMnemonic() || mnemonicInput;
    if (!mnemonic) {
      toast.error("Mnemonic is required to decrypt sharing keys");
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
        mnemonic,
        customMessage || undefined
      );
      const shareId = crypto.randomUUID();
      await storeFileShare(shareId, "encrypted-share", preparation);
      toast.success(
        `File "${file.name}" has been prepared for sharing with ${recipientEmail}`,
        { id: sharingToastId }
      );

      // Refresh credit balance after successful share
      await refreshCredits();

      // Keep mnemonic available for multiple shares in the same session
      // User can close/refresh page to clear it

      setFile(null);
      setRecipientEmail("");
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Error sharing file:", error);

      // Check if error is due to insufficient credits
      if (
        error instanceof Error &&
        (error.message.includes("Insufficient credits") ||
          error.message.includes("PAYMENT_REQUIRED"))
      ) {
        toast.error("Insufficient credits", {
          description: "You don't have enough credits to share this file. Each share costs 1 credit, with an additional 0.5 credit for email notifications.",
          id: sharingToastId,
          duration: 8000,
        });
      }
      // Check if error is due to missing recipient key
      else if (
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Share Files</h1>
        <p className="text-muted-foreground mt-1">
          Securely share your encrypted files with other ZeroDrive users
        </p>
      </div>

      <div className="max-w-6xl">
        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card: Main File Sharing */}
          <Card className="h-fit">
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
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-green-800 dark:text-green-300">
                          Sharing Keys Active
                        </h3>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                          You can now select a file and recipient to share securely.
                        </p>
                      </div>
                      {!isLoadingCredits && creditBalance !== null && (
                        <div className="text-right">
                          <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                            Credits
                          </p>
                          <p className={`text-lg font-bold ${
                            creditBalance < 1
                              ? 'text-red-600 dark:text-red-400'
                              : creditBalance < 3
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-green-800 dark:text-green-300'
                          }`}>
                            {creditBalance.toFixed(1)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {creditBalance !== null && creditBalance < 3 && creditBalance >= 1 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        ⚠️ Low credits warning: You have {creditBalance.toFixed(1)} credits remaining.
                        Each share costs 1 credit (+ 0.5 for email notifications).
                      </p>
                    </div>
                  )}

                  {creditBalance !== null && creditBalance < 1 && (
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-800 dark:text-red-300 font-medium">
                        ❌ Out of credits: You need at least 1 credit to share files.
                      </p>
                    </div>
                  )}

                  {showMnemonicInput && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                        Mnemonic Required
                      </h3>
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                        Enter your mnemonic to decrypt sharing keys. This will
                        only be used for decryption.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Enter your mnemonic phrase"
                          value={mnemonicInput}
                          onChange={(e) => setMnemonicInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && mnemonicInput) {
                              verifyMnemonic();
                            }
                          }}
                          disabled={isVerifyingMnemonic}
                          className="flex-1"
                        />
                        <Button
                          onClick={verifyMnemonic}
                          disabled={!mnemonicInput || isVerifyingMnemonic}
                        >
                          {isVerifyingMnemonic ? "Verifying..." : "Verify"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
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
                  !hasGeneratedKeys ||
                  (showMnemonicInput && !mnemonicVerified) ||
                  (creditBalance !== null && creditBalance < 1)
                }
              >
                {isSharing ? "Preparing Share..." : creditBalance !== null && creditBalance < 1 ? "Insufficient Credits" : "Share Encrypted File"}
              </Button>
            </CardContent>
          </Card>

          {/* Right Card: Custom Message */}
          <Card className="h-fit">
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
