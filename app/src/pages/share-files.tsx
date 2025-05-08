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
import { v4 as uuidv4 } from "uuid";
import { prepareFileForSharing, storeFileShare } from "../utils/fileSharing";
import { uploadAndSyncFile } from "../utils/fileOperations";
import {
  generateUserKeyPair,
  storeUserPublicKey,
  hashEmail,
} from "../utils/fileSharing";
import { storeUserKeyPair, userHasStoredKeys } from "../utils/keyStorage";

const ShareFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [senderEmail, setSenderEmail] = useState<string>("");
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [hasGeneratedKeys, setHasGeneratedKeys] = useState<boolean>(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState<boolean>(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState<boolean>(true);

  // Check if the user has generated keys
  useEffect(() => {
    const checkForKeys = async () => {
      if (!senderEmail) return;

      setIsCheckingKeys(true);
      try {
        // Check if current user has keys stored in IndexedDB
        const hasKeys = await userHasStoredKeys(senderEmail);
        setHasGeneratedKeys(hasKeys);
      } catch (error) {
        console.error("Error checking for keys:", error);
      } finally {
        setIsCheckingKeys(false);
      }
    };

    if (senderEmail) {
      checkForKeys();
    }
  }, [senderEmail]);

  // Get the user's email from Google auth
  useEffect(() => {
    const getUserEmail = () => {
      try {
        const authInstance = gapi.auth2?.getAuthInstance();
        if (authInstance && authInstance.isSignedIn.get()) {
          const profile = authInstance.currentUser.get().getBasicProfile();
          if (profile) {
            const email = profile.getEmail();
            setSenderEmail(email);
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
      toast.error("User email not available");
      return;
    }

    setIsGeneratingKeys(true);
    toast.loading("Generating your encryption keys...");

    try {
      // Generate a new key pair
      const keyPair = await generateUserKeyPair();

      // Hash the user's email
      const hashedEmail = await hashEmail(senderEmail);

      // Store the public key in Supabase
      await storeUserPublicKey(hashedEmail, keyPair.publicKeyJwk);

      // Store the key pair in IndexedDB, associated with this user
      await storeUserKeyPair(senderEmail, keyPair);

      setHasGeneratedKeys(true);
      toast.success(
        "Your keys have been generated and your public key has been registered"
      );
    } catch (error) {
      console.error("Error generating keys:", error);

      // Provide more specific guidance based on the error
      let errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      let description = "";

      if (
        errorMessage.includes("Invalid API key") ||
        errorMessage.includes("connect") ||
        errorMessage.includes("network")
      ) {
        description =
          "Please check your internet connection and Supabase setup. Make sure the Supabase credentials in .env.local are correct.";
      } else if (
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation")
      ) {
        description =
          "Database tables may not exist yet. Make sure to run the SQL setup script in Supabase.";
      }

      toast.error("Failed to generate keys", {
        description: description || errorMessage,
      });
    } finally {
      setIsGeneratingKeys(false);
      toast.dismiss();
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
      toast.error("You need to generate keys first");
      return;
    }

    setIsSharing(true);
    const sharingToastId = toast.loading(`Preparing to share ${file.name}...`);

    try {
      // Step 1: Prepare the file for sharing
      toast.loading("Encrypting file for recipient...", { id: sharingToastId });
      const preparation = await prepareFileForSharing(
        file,
        recipientEmail,
        senderEmail
      );

      // Step 2: Skip Google Drive upload, generate a unique share ID
      const shareId = uuidv4();

      // Step 3: Store only the sharing metadata in Supabase
      await storeFileShare(shareId, "zk-share-file", preparation);

      toast.success(
        `File "${file.name}" has been shared with ${recipientEmail}`,
        { id: sharingToastId }
      );

      // Reset form
      setFile(null);
      setRecipientEmail("");

      // Reset the file input element
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
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
            <CardTitle>Share Files</CardTitle>
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
            Securely share encrypted files with others
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!hasGeneratedKeys ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Key Setup Required
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
                Before sharing files, you need to generate your encryption keys.
                This is a one-time setup.
              </p>
              <Button
                size="sm"
                onClick={handleGenerateKeys}
                disabled={isGeneratingKeys || !senderEmail}
                className="w-full"
              >
                {isGeneratingKeys ? "Generating Keys..." : "Generate My Keys"}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label htmlFor="file-input">File to Share</Label>
                <Input
                  id="file-input"
                  type="file"
                  onChange={handleFileChange}
                  disabled={isSharing}
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label htmlFor="recipient-email">Recipient Email</Label>
                <Input
                  id="recipient-email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={handleRecipientEmailChange}
                  disabled={isSharing}
                />
                <p className="text-xs text-muted-foreground">
                  The recipient must have registered their public key in the
                  system.
                </p>
              </div>

              <Button
                className="w-full mt-2"
                onClick={handleShareFile}
                disabled={!file || !recipientEmail || isSharing || !senderEmail}
              >
                {isSharing ? "Sharing..." : "Share File"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShareFilesPage;
