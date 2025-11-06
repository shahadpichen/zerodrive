/**
 * Google API Initialization
 * Uses server-based OAuth tokens from backend for Drive API access
 */

import { gapi } from "gapi-script";
import { getOrFetchGoogleToken } from "./authService";
import logger from "./logger";

let isGapiInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize Google API client with token from backend
 */
export const initializeGapi = async (): Promise<void> => {
  // If already initialized, return immediately
  if (isGapiInitialized) {
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      // Load gapi client
      logger.log("[GAPI] Loading Google API client library...");
      await new Promise<void>((resolve) => {
        gapi.load("client", () => resolve());
      });

      // Initialize client with Drive API
      logger.log("[GAPI] Initializing Drive API...");
      await gapi.client.init({
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        ],
      });

      // Get access token from backend
      logger.log("[GAPI] Fetching Google access token from backend...");
      const accessToken = await getOrFetchGoogleToken();
      if (!accessToken) {
        logger.error("[GAPI] No access token received from backend");
        throw new Error("Failed to get Google access token from backend. Please ensure you've completed Google OAuth.");
      }

      // Set the token for API requests
      gapi.client.setToken({
        access_token: accessToken,
      });

      isGapiInitialized = true;
      logger.log("[GAPI] Successfully initialized with backend token");
    } catch (error) {
      logger.error("[GAPI] Initialization failed:", error);
      initializationPromise = null; // Reset so we can retry
      throw error;
    }
  })();

  return initializationPromise;
};

/**
 * Get current Google access token for direct API calls
 * @returns Access token or null if not available
 */
export const getGoogleAccessToken = async (): Promise<string | null> => {
  try {
    // Ensure gapi is initialized
    await initializeGapi();

    // Get token from backend
    const token = await getOrFetchGoogleToken();

    // Update gapi client token if we got a new one
    if (token) {
      gapi.client.setToken({
        access_token: token,
      });
    }

    return token;
  } catch (error) {
    logger.error("[GAPI] Failed to get access token:", error);
    return null;
  }
};

/**
 * Refresh the Google access token
 * This will fetch a new token from backend (backend handles refresh token logic)
 */
export const refreshGapiToken = async (): Promise<void> => {
  try {
    const token = await getOrFetchGoogleToken();
    if (!token) {
      throw new Error("Failed to refresh token");
    }

    gapi.client.setToken({
      access_token: token,
    });

    logger.log("[GAPI] Token refreshed successfully");
  } catch (error) {
    logger.error("[GAPI] Failed to refresh token:", error);
    throw error;
  }
};
