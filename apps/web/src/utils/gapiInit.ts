/**
 * Google API Initialization
 * Uses server-based OAuth tokens from backend for Drive API access
 */

import { gapi } from "gapi-script";
import { getOrFetchGoogleToken } from "./authService";
import logger from "./logger";

let isGapiInitialized = false;
let initializationPromise: Promise<void> | null = null;
const GAPI_INITIALIZATION_TIMEOUT_MS = 15_000;

const withTimeout = async <T>(
  operation: Promise<T>,
  message: string,
): Promise<T> => {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(message)),
          GAPI_INITIALIZATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

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
      await new Promise<void>((resolve, reject) => {
        const load = gapi.load as unknown as (
          api: string,
          options: {
            callback: () => void;
            onerror: () => void;
            timeout: number;
            ontimeout: () => void;
          },
        ) => void;
        load("client", {
          callback: resolve,
          onerror: () =>
            reject(new Error("Google API client could not be loaded.")),
          timeout: GAPI_INITIALIZATION_TIMEOUT_MS,
          ontimeout: () =>
            reject(new Error("Google API client did not respond in time.")),
        });
      });

      // Initialize client with Drive API
      logger.log("[GAPI] Initializing Drive API...");
      await withTimeout(
        gapi.client.init({
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
        }),
        "Google Drive client initialization timed out.",
      );

      // Get access token from sessionStorage
      logger.log("[GAPI] Fetching Google access token from sessionStorage...");
      const accessToken = await getOrFetchGoogleToken();
      if (!accessToken) {
        logger.error("[GAPI] No access token found in sessionStorage");
        throw new Error("Google access token not found. Your session may have expired. Please sign out and sign in again to reconnect Google Drive.");
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
export const getGoogleAccessToken = async (
  options: {
    forceRefresh?: boolean;
    minValidityMs?: number;
  } = {},
): Promise<string | null> => {
  try {
    // Ensure gapi is initialized
    await initializeGapi();

    // Get token from backend
    const token = await getOrFetchGoogleToken(options);

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
    const token = await getOrFetchGoogleToken({ forceRefresh: true });
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
