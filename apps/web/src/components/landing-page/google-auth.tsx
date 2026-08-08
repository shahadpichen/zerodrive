import React, { useState } from "react";
import { Button } from "../ui/button";
import googleLogo from "../../assets/google.png";
import { login } from "../../utils/authService";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
  theme?: "dark" | "light";
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ theme = "dark" }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isTrustDialogOpen, setIsTrustDialogOpen] = useState(false);

  const openTrustDialog = () => {
    setIsTrustDialogOpen(true);
  };

  const continueWithGoogle = () => {
    setIsSigningIn(true);
    // Redirect to backend OAuth endpoint
    login();
  };

  return (
    <>
      <Button
        onClick={openTrustDialog}
        className="px-8 py-2 h-12 text-base font-medium w-fit shadow-md"
        disabled={isSigningIn}
      >
        {isSigningIn ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Redirecting to Google...
          </>
        ) : (
          <>
            <img src={googleLogo} alt="Google Logo" className="w-4 h-4 mr-2" />
            Sign in with Google
          </>
        )}
      </Button>

      <Dialog open={isTrustDialogOpen} onOpenChange={setIsTrustDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Before Google asks for access</DialogTitle>
            <DialogDescription>
              ZeroDrive uses limited Google Drive access to save encrypted
              files in your own Google Drive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Google may show a permission screen and send an account-access
              email after sign-in. That email confirms the access you approved.
            </p>
            <p>
              Files are encrypted in this browser before upload. ZeroDrive
              cannot read your original files or reset your recovery phrase.
            </p>
            <p>
              ZeroDrive asks for your Google account email for sign-in, plus
              limited Drive access for encrypted files and hidden app metadata.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTrustDialogOpen(false)}
              disabled={isSigningIn}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={continueWithGoogle}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <img
                    src={googleLogo}
                    alt=""
                    aria-hidden="true"
                    className="w-4 h-4 mr-2"
                  />
                  Continue with Google
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
