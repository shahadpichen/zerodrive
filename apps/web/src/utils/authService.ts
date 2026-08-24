/**
 * Authentication Service
 * Handles JWT token management and authentication flow
 */

import apiClient from "./apiClient";
import logger from "./logger";
import type { AuthenticatedUser } from "@zerodrive/shared-types";
import {
  AUTH_SESSION_CLEARED_EVENT,
  GOOGLE_DRIVE_PERMISSION_EVENT,
  prepareForAuthSessionClear,
} from "./authEvents";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// JWT token is now stored in httpOnly cookie, not localStorage
// Only short-lived access tokens are stored in sessionStorage.
// Google refresh tokens remain in an httpOnly backend cookie.
// Also cached in memory for performance
let googleTokenCache: {
  token: string;
  expiry: Date;
  userEmail: string;
} | null = null;

export const GOOGLE_TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

function readBrowserSessionAccountEmail(): string {
  try {
    const storedTokens = sessionStorage.getItem("google-tokens");
    if (storedTokens) {
      const parsed = JSON.parse(storedTokens) as { userEmail?: unknown };
      if (typeof parsed.userEmail === "string" && parsed.userEmail.trim()) {
        return parsed.userEmail.trim().toLowerCase();
      }
    }
  } catch {
    // Fall back to the explicit account marker below.
  }

  return (sessionStorage.getItem("session-user-email") ?? "")
    .trim()
    .toLowerCase();
}

async function bindSensitiveBrowserSessionToAuthenticatedUser(
  authenticatedEmail: string,
): Promise<void> {
  const expectedEmail = authenticatedEmail.trim().toLowerCase();
  const browserSessionEmail = readBrowserSessionAccountEmail();

  if (browserSessionEmail && browserSessionEmail !== expectedEmail) {
    logger.warn(
      "[Auth] Browser session belongs to a different account; clearing sensitive local state",
    );
    await clearSensitiveBrowserSession();
  }

  sessionStorage.setItem("session-user-email", expectedEmail);
}

/**
 * Initiate login by redirecting to backend OAuth
 */
export function login(): void {
  window.location.href = `${API_URL}/auth/google`;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  logger.log("[Logout] Starting logout process...");
  logger.log("[Logout] CSRF token:", getCsrfToken() ? "Present" : "Missing");
  logger.log("[Logout] API URL:", API_URL);

  // Stop uploads before revoking the backend session or clearing the Google
  // token and recovery phrase. Cancellation may need both to remove an
  // accepted Drive object and restore the authoritative vault index.
  await prepareForAuthSessionClear();

  // Call backend logout endpoint to clear httpOnly cookies FIRST
  try {
    const csrfToken = getCsrfToken();
    logger.log("[Logout] Sending logout request to backend...");

    const response = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      },
      credentials: "include", // Send cookies
    });

    logger.log(
      "[Logout] Backend response status:",
      response.status,
      response.ok ? "OK" : "ERROR",
    );

    // Consume the response body to ensure request completes
    const responseData = await response.text();
    logger.log("[Logout] Backend response:", responseData);

    if (!response.ok) {
      logger.warn(
        "[Logout] Backend logout returned error status:",
        response.status,
      );
      // Continue with local logout even if backend fails
    } else {
      logger.log("[Logout] Backend logout successful");
    }
  } catch (error) {
    logger.error("[Logout] Backend logout failed with error:", error);
    // Continue with local logout even if backend fails
  }

  // Clear local storage and session storage
  logger.log("[Logout] Clearing local storage and session storage...");
  await clearSensitiveBrowserSession();
  window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
  logger.log("[Logout] Logout process complete");
}

/**
 * Get CSRF token from cookie (readable by JavaScript)
 */
export function getCsrfToken(): string | null {
  const name = "zerodrive_csrf=";
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name)) {
      return cookie.substring(name.length);
    }
  }
  return null;
}

/**
 * Check if user is authenticated by calling backend
 * (JWT token is httpOnly cookie, can't access from JavaScript)
 */
export async function isAuthenticated(): Promise<boolean> {
  // Quick check: do we have auth cookies?
  const hasCookies = document.cookie.includes("zerodrive_csrf");

  if (!hasCookies) {
    await clearSensitiveBrowserSession();
    return false;
  }

  try {
    const response = await apiClient.get<AuthenticatedUser>("/auth/me");
    const email = response.success ? response.data?.email : undefined;
    if (!email) return false;
    await bindSensitiveBrowserSessionToAuthenticatedUser(email);
    return true;
  } catch (error) {
    logger.error("[Auth] Authentication check failed:", error);
    return false;
  }
}

/**
 * Get user email from backend /me endpoint
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const response = await apiClient.get<AuthenticatedUser>("/auth/me");
    const email = response.data?.email;
    if (!email) return null;
    await bindSensitiveBrowserSessionToAuthenticatedUser(email);
    return email;
  } catch (error) {
    logger.error("Failed to get user email:", error);
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const response = await apiClient.get<AuthenticatedUser>("/auth/me");
    if (!response.success || !response.data?.email) return null;
    await bindSensitiveBrowserSessionToAuthenticatedUser(response.data.email);
    return response.data;
  } catch (error) {
    logger.error("Failed to get authenticated user:", error);
    return null;
  }
}

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture: string;
}

export async function getGoogleUserProfile(
  accessToken: string,
): Promise<GoogleUserProfile | null> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      logger.warn("[Auth] Failed to fetch Google profile", {
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!data.email) return null;

    return {
      email: data.email,
      name: data.name || data.email.split("@")[0],
      picture: data.picture || "",
    };
  } catch (error) {
    logger.warn("[Auth] Failed to fetch Google profile", error);
    return null;
  }
}

/**
 * Refresh access token using refresh token cookie
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send refresh token cookie
      headers: {
        "Content-Type": "application/json",
        ...(getCsrfToken() && { "X-CSRF-Token": getCsrfToken()! }),
      },
    });
    return response.ok;
  } catch (error) {
    logger.error("Token refresh failed:", error);
    return false;
  }
}

/**
 * Check if cached Google token is valid for the given user
 */
function isGoogleTokenCacheValid(
  userEmail: string,
  minValidityMs: number = 0,
): boolean {
  if (!googleTokenCache) {
    return false;
  }

  // Check if cache is for the same user
  if (googleTokenCache.userEmail !== userEmail) {
    return false;
  }

  // Check if token is expired or too close to expiry for a long operation.
  return Date.now() + minValidityMs < googleTokenCache.expiry.getTime();
}

/**
 * Refresh Google access token using refresh token
 * @returns Access token if successful, 'NO_REFRESH_TOKEN' if missing, null if refresh failed
 */
async function refreshGoogleAccessToken(
  userEmail: string,
): Promise<string | "NO_REFRESH_TOKEN" | null> {
  try {
    const storedData = sessionStorage.getItem("google-tokens");
    if (!storedData) {
      logger.log("[Auth] No tokens to refresh");
      return null;
    }

    const parsed = JSON.parse(storedData);
    logger.log("[Auth] Attempting to refresh Google access token...");
    const response = await fetch(`${API_URL}/auth/google/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getCsrfToken() && { "X-CSRF-Token": getCsrfToken()! }),
      },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      logger.error("[Auth] Token refresh failed with status:", response.status);
      return null;
    }

    const responseBody = (await response.json()) as {
      success?: boolean;
      data?: {
        accessToken?: string;
        expiresAt?: string;
      };
    };
    const refreshedToken = responseBody.data;
    if (
      responseBody.success !== true ||
      !refreshedToken?.accessToken ||
      !refreshedToken.expiresAt
    ) {
      logger.error("[Auth] Invalid refresh response");
      return null;
    }

    // Store new tokens
    await storeGoogleTokens(
      {
        accessToken: refreshedToken.accessToken,
        expiresAt: new Date(refreshedToken.expiresAt),
        scope: parsed.scope,
      },
      userEmail,
    );

    logger.log("[Auth] Google access token refreshed successfully");
    return refreshedToken.accessToken;
  } catch (error) {
    logger.error("[Auth] Error refreshing Google token:", error);
    return null;
  }
}

/**
 * Get Google access token from sessionStorage
 */
export async function getGoogleTokenFromStorage(
  userEmail: string,
  options: {
    forceRefresh?: boolean;
    minValidityMs?: number;
  } = {},
): Promise<string | null> {
  try {
    const storedData = sessionStorage.getItem("google-tokens");
    if (!storedData) {
      logger.log("[Auth] No Google tokens found in sessionStorage");
      return null;
    }

    const parsed = JSON.parse(storedData);

    // Check if tokens are for the correct user
    if (parsed.userEmail !== userEmail) {
      logger.warn("[Auth] Stored tokens are for different user, clearing");
      await clearSensitiveBrowserSession();
      return null;
    }

    const minValidityMs = options.minValidityMs ?? 0;

    // Check if token is expired or too close to expiry for the requested flow.
    const expiresAt = new Date(parsed.expiresAt);
    const now = Date.now();
    if (options.forceRefresh || now + minValidityMs >= expiresAt.getTime()) {
      logger.log("[Auth] Google access token needs refresh");

      // Try to refresh the token before clearing
      const refreshResult = await refreshGoogleAccessToken(userEmail);

      if (refreshResult === "NO_REFRESH_TOKEN") {
        // No refresh token available - need to re-authenticate
        logger.warn(
          "[Auth] Cannot refresh without refresh token - redirecting to login",
        );
        logger.log(
          "[Auth] Clearing tokens and redirecting to re-authenticate...",
        );
        clearGoogleTokens();

        // Redirect to login to get fresh tokens with refresh token
        window.location.href = "/";
        return null;
      }

      if (refreshResult) {
        // Refresh successful
        logger.log("[Auth] Token refreshed successfully, continuing...");
        return refreshResult;
      }

      // Refresh failed for other reasons, clear tokens
      logger.error("[Auth] Token refresh failed, clearing tokens");
      clearGoogleTokens();
      return null;
    }

    // Update memory cache
    googleTokenCache = {
      token: parsed.accessToken,
      expiry: expiresAt,
      userEmail,
    };

    return parsed.accessToken;
  } catch (error) {
    logger.error("[Auth] Error reading Google tokens:", error);
    clearGoogleTokens();
    return null;
  }
}

/**
 * Get Google token (from cache or retrieve from sessionStorage)
 */
export async function getOrFetchGoogleToken(
  options: {
    forceRefresh?: boolean;
    minValidityMs?: number;
  } = {},
): Promise<string | null> {
  // Get current user email
  const userEmail = await getUserEmail();
  if (!userEmail) {
    logger.error("Cannot get Google token: user not authenticated");
    return null;
  }

  // Check if we have a valid cached token in memory
  if (
    !options.forceRefresh &&
    isGoogleTokenCacheValid(userEmail, options.minValidityMs ?? 0)
  ) {
    return googleTokenCache!.token;
  }

  // Token expired or not in cache, try to get from sessionStorage
  return await getGoogleTokenFromStorage(userEmail, options);
}

/**
 * Store short-lived Google access tokens in sessionStorage.
 */
export async function storeGoogleTokens(
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    scope: string;
  },
  userEmail: string,
): Promise<void> {
  try {
    // Update memory cache for performance
    googleTokenCache = {
      token: tokens.accessToken,
      expiry: tokens.expiresAt,
      userEmail,
    };

    const stored = {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
      userEmail,
    };
    sessionStorage.setItem("google-tokens", JSON.stringify(stored));
    window.dispatchEvent(new Event(GOOGLE_DRIVE_PERMISSION_EVENT));
    logger.log("[Auth] Stored Google tokens in sessionStorage", {
      expiresAt: tokens.expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error("[Auth] Failed to store Google tokens:", error);
    throw error;
  }
}

/**
 * Clear Google tokens from memory cache and sessionStorage
 */
export function clearGoogleTokens(): void {
  googleTokenCache = null;
  sessionStorage.removeItem("google-tokens");
  window.dispatchEvent(new Event(GOOGLE_DRIVE_PERMISSION_EVENT));
}

export async function clearSensitiveBrowserSession(): Promise<void> {
  try {
    await prepareForAuthSessionClear();
  } finally {
    googleTokenCache = null;
    const [{ clearMnemonic }, { clearStoredKey }] = await Promise.all([
      import("./mnemonicManager"),
      import("./cryptoUtils"),
    ]);
    clearMnemonic();
    clearStoredKey();
    sessionStorage.clear();
  }
}

/**
 * Check if Google tokens exist in sessionStorage
 * @returns true if tokens exist, false otherwise
 */
export function hasGoogleTokensInStorage(): boolean {
  const storedData = sessionStorage.getItem("google-tokens");
  return storedData !== null;
}
