import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import { Button } from "../ui/button";
import { FaGoogle } from "react-icons/fa";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
  theme?: "dark" | "light";
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({
  onAuthChange,
  theme = "dark",
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initClient = async () => {
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
          localStorage.setItem("isAuthenticated", "true");
          onAuthChange(true);
          window.location.href = "/storage";
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing Google Auth:", error);
      }
    };

    initClient();
  }, [onAuthChange]);

  const handleSignIn = async () => {
    try {
      if (!isInitialized) return;

      const authInstance = gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();

      if (user) {
        localStorage.setItem("isAuthenticated", "true");
        onAuthChange(true);
        window.location.href = "/storage";
      }
    } catch (error) {
      console.error("Error signing in:", error);
      localStorage.removeItem("isAuthenticated");
      onAuthChange(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      className="px-8 py-2 h-12 text-base font-medium w-64 shadow-md"
      disabled={!isInitialized}
    >
      {/* <FaGoogle /> */}
      Sign in with Google
    </Button>
  );
};
