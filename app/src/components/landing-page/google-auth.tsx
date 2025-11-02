import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gapi } from "gapi-script";
import { Button } from "../ui/button";
import googleLogo from "../../assets/google.png";
import { setSessionUser } from "../../utils/sessionManager";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { trackLogin } from "../../utils/analyticsTracker";
import { userHasStoredKeys } from "../../utils/keyStorage";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
  theme?: "dark" | "light";
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({
  onAuthChange,
  theme = "dark",
}) => {
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const initClient = async () => {
      setIsInitializing(true);
      try {
        await new Promise<void>((resolve) => {
          gapi.load("client:auth2", resolve);
        });

        await gapi.client.init({
          clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
        });

        const authInstance = gapi.auth2.getAuthInstance();

        // Check if already signed in
        if (authInstance.isSignedIn.get()) {
          const currentUser = authInstance.currentUser.get();
          const profile = currentUser.getBasicProfile();
          const email = profile?.getEmail();
          if (email) {
            setSessionUser(email);
          }
          sessionStorage.setItem("isAuthenticated", "true");
          onAuthChange(true);

          // Track login analytics for already signed-in user
          try {
            const hasStoredKeys = email ? await userHasStoredKeys(email) : false;
            const isNewUser = !hasStoredKeys;

            const grantedScopes = currentUser.getGrantedScopes() || '';
            const hasFullDriveScope = grantedScopes.includes('https://www.googleapis.com/auth/drive.file') ||
                                       grantedScopes.includes('https://www.googleapis.com/auth/drive');
            const hasLimitedScope = !hasFullDriveScope;

            await trackLogin(isNewUser, hasLimitedScope);
          } catch (error) {
            console.error('Failed to track login:', error);
          }

          navigate("/storage");
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing Google Auth:", error);
        toast.error("Failed to initialize Google Sign-In", {
          description: "Please refresh the page and try again.",
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initClient();
  }, [onAuthChange, navigate]);

  const handleSignIn = async () => {
    if (!isInitialized || isSigningIn) return;

    setIsSigningIn(true);

    try {
      const authInstance = gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();

      if (user) {
        const profile = user.getBasicProfile();
        const email = profile?.getEmail();
        if (email) {
          setSessionUser(email);
        }
        sessionStorage.setItem("isAuthenticated", "true");
        onAuthChange(true);

        // Track login analytics
        try {
          const hasStoredKeys = email ? await userHasStoredKeys(email) : false;
          const isNewUser = !hasStoredKeys;

          // Check if user granted full Google Drive scope
          const grantedScopes = user.getGrantedScopes() || '';
          const hasFullDriveScope = grantedScopes.includes('https://www.googleapis.com/auth/drive.file') ||
                                     grantedScopes.includes('https://www.googleapis.com/auth/drive');
          const hasLimitedScope = !hasFullDriveScope;

          await trackLogin(isNewUser, hasLimitedScope);
        } catch (error) {
          // Don't let analytics tracking break the login flow
          console.error('Failed to track login:', error);
        }

        toast.success("Signed in successfully!");
        navigate("/storage");
      }
    } catch (error: any) {
      console.error("Error signing in:", error);
      sessionStorage.removeItem("isAuthenticated");
      onAuthChange(false);

      // Handle different error types
      if (error?.error === "popup_closed_by_user") {
        toast.info("Sign-in cancelled", {
          description: "You closed the sign-in window. Click to try again.",
        });
      } else if (error?.error === "popup_blocked_by_browser") {
        toast.error("Popup blocked", {
          description: "Please allow popups for this site and try again.",
          action: {
            label: "Retry",
            onClick: () => handleSignIn(),
          },
        });
      } else if (error?.error === "access_denied") {
        toast.error("Access denied", {
          description: "You need to grant permissions to sign in.",
        });
      } else {
        toast.error("Sign-in failed", {
          description: "Could not connect to Google. Please try again.",
          action: {
            label: "Retry",
            onClick: () => handleSignIn(),
          },
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      className="px-8 py-2 h-12 text-base font-medium w-64 shadow-md"
      disabled={!isInitialized || isInitializing || isSigningIn}
    >
      {isInitializing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Connecting to Google...
        </>
      ) : isSigningIn ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <img src={googleLogo} alt="Google Logo" className="w-4 h-4 mr-2" />
          Sign in with Google
        </>
      )}
    </Button>
  );
};
