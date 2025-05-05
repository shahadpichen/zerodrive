import React, { useEffect } from "react";

function GoogleOAuthCallback() {
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

    if (window.opener) {
      if (error) {
        window.opener.postMessage(
          { type: "GOOGLE_SIGN_IN_ERROR", error },
          window.location.origin
        );
      } else if (idToken && state) {
        // Send the successful token and state back to the opener window
        window.opener.postMessage(
          { type: "GOOGLE_SIGN_IN_SUCCESS", idToken, state },
          window.location.origin
        );
      } else {
        // Handle unexpected case
        window.opener.postMessage(
          {
            type: "GOOGLE_SIGN_IN_ERROR",
            error: "Missing id_token or state in callback",
          },
          window.location.origin
        );
      }
      // Close the popup window
      window.close();
    } else {
      // Handle case where opener is not available (e.g., page opened directly)
      console.error("No window.opener available for postMessage.");
      // Maybe display an error message to the user in the popup itself
    }
  }, []); // Run only once on component mount

  // Render minimal content, as the window should close quickly
  return <div>Processing Google Sign-in...</div>;
}

export default GoogleOAuthCallback;
