import React, { useState } from "react";
import { Button } from "../ui/button";
import googleLogo from "../../assets/google.png";
import { login } from "../../utils/authService";
import { Loader2 } from "lucide-react";

interface GoogleAuthProps {
  onAuthChange: (authenticated: boolean) => void;
  theme?: "dark" | "light";
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ theme = "dark" }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = () => {
    setIsSigningIn(true);
    // Redirect to backend OAuth endpoint
    login();
  };

  return (
    <Button
      onClick={handleSignIn}
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
  );
};
