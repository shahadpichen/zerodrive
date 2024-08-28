import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import { Button } from "./ui/button";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const initClient = () => {
      gapi.client
        .init({
          clientId: process.env.REACT_APP_CLIENT_ID,
          scope: process.env.REACT_APP_SCOPE,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          setIsAuthenticated(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen((signedIn) => {
            setIsAuthenticated(signedIn);
            onAuthChange(signedIn);
          });
        });
    };
    gapi.load("client:auth2", initClient);
  }, [onAuthChange]);

  const handleLogin = () => {
    gapi.auth2.getAuthInstance().signIn();
  };

  const handleLogout = () => {
    gapi.auth2.getAuthInstance().signOut();
    setIsAuthenticated(false);
    onAuthChange(false);
  };

  return (
    <>
      {isAuthenticated ? (
        <Button onClick={handleLogout}>Logout</Button>
      ) : (
        <Button onClick={handleLogin}>Login with Google</Button>
      )}
    </>
  );
};
