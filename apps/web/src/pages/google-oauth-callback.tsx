import React, { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

function GoogleOAuthCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Function to parse fragment parameters
    const getFragmentParams = (): { [key: string]: string } => {
      const fragment = window.location.hash.substring(1);
      const params: { [key: string]: string } = {};
      const regex = /([^&=]+)=([^&]*)/g;
      let m;
      while ((m = regex.exec(fragment)) !== null) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
      }
      return params;
    };

    const params = getFragmentParams();
    const idToken = params["id_token"];
    const state = params["state"];
    const error = params["error"];
    const errorDescription = params["error_description"];

    if (window.opener) {
      if (error) {
        setStatus("error");
        setErrorMessage(errorDescription || error);
        window.opener.postMessage(
          { type: "GOOGLE_SIGN_IN_ERROR", error, errorDescription },
          window.location.origin
        );
        // Close after 2 seconds to show error
        setTimeout(() => window.close(), 2000);
      } else if (idToken && state) {
        setStatus("success");
        // Send the successful token and state back to the opener window
        window.opener.postMessage(
          { type: "GOOGLE_SIGN_IN_SUCCESS", idToken, state },
          window.location.origin
        );
        // Close immediately on success
        setTimeout(() => window.close(), 500);
      } else {
        setStatus("error");
        setErrorMessage("Missing authentication data");
        // Handle unexpected case
        window.opener.postMessage(
          {
            type: "GOOGLE_SIGN_IN_ERROR",
            error: "invalid_callback",
            errorDescription: "Missing id_token or state in callback",
          },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
      }
    } else {
      // Handle case where opener is not available (e.g., page opened directly)
      setStatus("error");
      setErrorMessage("This page should be opened from the authentication popup.");
      console.error("No window.opener available for postMessage.");
    }
  }, []); // Run only once on component mount

  // Render feedback based on status
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium">Processing Google Sign-in...</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">Sign-in successful!</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">Sign-in failed</p>
            <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
            <p className="text-xs text-muted-foreground mt-4">This window will close automatically.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default GoogleOAuthCallback;
