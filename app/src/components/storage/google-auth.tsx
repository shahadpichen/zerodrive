import React, { useEffect } from "react";
import { gapi } from "gapi-script";
import { useNavigate } from "react-router-dom";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const initClient = () => {
      gapi.client
        .init({
          clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();

          const handleAuthChange = (signedIn: boolean) => {
            onAuthChange(signedIn);
            if (signedIn) {
              localStorage.setItem("isAuthenticated", "true");
              navigate("/storage");
            }
          };

          authInstance.isSignedIn.listen(handleAuthChange);
        });
    };

    gapi.load("client:auth2", initClient);

    const renderSignInButton = () => {
      const buttonElement = document.getElementById("google-signin-button");
      if (buttonElement) {
        gapi.signin2.render(buttonElement, {
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
          width: 240,
          height: 50,
          longtitle: true,
          theme: "dark",
          onsuccess: () => {
            onAuthChange(true);
            localStorage.setItem("isAuthenticated", "true");
            navigate("/storage");
          },
          onfailure: () => {
            onAuthChange(false);
          },
        });
      }
    };

    renderSignInButton();

    return () => {
      const buttonElement = document.getElementById("google-signin-button");
      if (buttonElement) {
        buttonElement.innerHTML = "";
      }
    };
  }, [onAuthChange, navigate]);

  return <div id="google-signin-button"></div>;
};
