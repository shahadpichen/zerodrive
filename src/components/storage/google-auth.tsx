import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import { Button } from "../ui/button";
import { clearStoredKey } from "../../utils/cryptoUtils";
import { useNavigate } from "react-router-dom";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
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
          const isSignedIn = authInstance.isSignedIn.get();
          setIsAuthenticated(isSignedIn);
          onAuthChange(isSignedIn);

          if (isSignedIn) {
            localStorage.setItem("isAuthenticated", "true");
            navigate("/storage");
          } else {
            localStorage.removeItem("isAuthenticated");
          }

          authInstance.isSignedIn.listen((signedIn) => {
            setIsAuthenticated(signedIn);
            onAuthChange(signedIn);

            if (signedIn) {
              localStorage.setItem("isAuthenticated", "true");
              navigate("/storage");
            } else {
              localStorage.removeItem("isAuthenticated");
            }
          });
        });
    };
    gapi.load("client:auth2", initClient);

    const storedAuthState = localStorage.getItem("isAuthenticated");
    if (storedAuthState === "true") {
      setIsAuthenticated(true);
      onAuthChange(true);
    }

    const renderSignInButton = () => {
      const buttonElement = document.getElementById("google-signin-button");
      if (buttonElement) {
        gapi.signin2.render(buttonElement, {
          scope: process.env.REACT_APP_PUBLIC_SCOPE,
          width: 240,
          height: 50,
          longtitle: true,
          theme: "dark",
          onsuccess: (googleUser: any) => {
            setIsAuthenticated(true);
            onAuthChange(true);
            navigate("/storage");
          },
          onfailure: () => {
            setIsAuthenticated(false);
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

  const handleLogin = () => {
    gapi.auth2.getAuthInstance().signIn();
  };

  const handleLogout = () => {
    gapi.auth2.getAuthInstance().signOut();
    setIsAuthenticated(false);
    onAuthChange(false);
    clearStoredKey();
    navigate("/");
    window.location.reload();
  };

  return (
    <>
      {isAuthenticated ? (
        <Button onClick={handleLogout}>Logout</Button>
      ) : (
        <div id="google-signin-button" onClick={handleLogin}></div>
      )}
    </>
  );
};
