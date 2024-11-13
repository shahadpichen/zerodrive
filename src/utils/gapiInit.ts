import { gapi } from "gapi-script";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export const initializeGapi = async () => {
  // Check if client is already initialized
  if (gapi.client && gapi.auth2?.getAuthInstance()) {
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance.isSignedIn.get()) {
      // Refresh token if needed
      const currentUser = authInstance.currentUser.get();
      const token = currentUser.getAuthResponse().access_token;
      gapi.client.setToken({
        access_token: token,
      });

      // Set default headers for all requests
      gapi.client.setApiKey(process.env.REACT_APP_PUBLIC_API_KEY || "");

      return authInstance;
    }
  }

  try {
    await new Promise((resolve) => {
      gapi.load("client:auth2", resolve);
    });

    await gapi.client.init({
      apiKey: process.env.REACT_APP_PUBLIC_API_KEY,
      clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
      scope: SCOPES.join(" "),
      discoveryDocs: [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
      ],
    });

    const authInstance = gapi.auth2.getAuthInstance();
    const isSignedIn = authInstance.isSignedIn.get();

    if (!isSignedIn) {
      // Only sign in if not already signed in
      await authInstance.signIn({
        prompt: "select_account",
        scope: SCOPES.join(" "),
      });
    }

    const currentUser = authInstance.currentUser.get();
    const token = currentUser.getAuthResponse().access_token;

    // Set token and API key for all requests
    gapi.client.setToken({
      access_token: token,
    });
    gapi.client.setApiKey(process.env.REACT_APP_PUBLIC_API_KEY || "");

    return authInstance;
  } catch (error) {
    console.error("Error initializing GAPI:", error);
    throw error;
  }
};

// Helper function to refresh token
export const refreshGapiToken = async () => {
  try {
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance) {
      const currentUser = authInstance.currentUser.get();
      await currentUser.reloadAuthResponse();
      const token = currentUser.getAuthResponse().access_token;
      gapi.client.setToken({
        access_token: token,
      });
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw error;
  }
};
