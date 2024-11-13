import React, { useEffect } from "react";
import { gapi } from "gapi-script";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
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

        // Render the sign-in button
        const buttonElement = document.getElementById("google-signin-button");
        if (buttonElement) {
          gapi.signin2.render("google-signin-button", {
            scope: process.env.REACT_APP_PUBLIC_SCOPE,
            width: 240,
            height: 50,
            longtitle: true,
            theme: "dark",
            onsuccess: () => {
              localStorage.setItem("isAuthenticated", "true");
              onAuthChange(true);
              // Use window.location instead of navigate
              window.location.href = "/storage";
            },
            onfailure: () => {
              localStorage.removeItem("isAuthenticated");
              onAuthChange(false);
            },
          });
        }

        // Check if already signed in
        if (authInstance.isSignedIn.get()) {
          localStorage.setItem("isAuthenticated", "true");
          onAuthChange(true);
          window.location.href = "/storage";
        }
      } catch (error) {
        console.error("Error initializing Google Auth:", error);
      }
    };

    initClient();

    return () => {
      const buttonElement = document.getElementById("google-signin-button");
      if (buttonElement) {
        buttonElement.innerHTML = "";
      }
    };
  }, [onAuthChange]);

  return <div id="google-signin-button"></div>;
};
