/**
 * Authentication Service
 * Handles JWT token management and authentication flow
 */

import apiClient from './apiClient';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// JWT token is now stored in httpOnly cookie, not localStorage
// Google tokens are stored unencrypted in sessionStorage (cleared on tab close)
// Also cached in memory for performance
let googleTokenCache: {
  token: string;
  expiry: Date;
  userEmail: string;
} | null = null;

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
  console.log('[Logout] Starting logout process...');
  console.log('[Logout] CSRF token:', getCsrfToken() ? 'Present' : 'Missing');
  console.log('[Logout] API URL:', API_URL);

  // Call backend logout endpoint to clear httpOnly cookies FIRST
  try {
    const csrfToken = getCsrfToken();
    console.log('[Logout] Sending logout request to backend...');

    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
      credentials: 'include', // Send cookies
    });

    console.log('[Logout] Backend response status:', response.status, response.ok ? 'OK' : 'ERROR');

    // Consume the response body to ensure request completes
    const responseData = await response.text();
    console.log('[Logout] Backend response:', responseData);

    if (!response.ok) {
      console.warn('[Logout] Backend logout returned error status:', response.status);
      // Continue with local logout even if backend fails
    } else {
      console.log('[Logout] Backend logout successful');
    }
  } catch (error) {
    console.error('[Logout] Backend logout failed with error:', error);
    // Continue with local logout even if backend fails
  }

  // Clear local storage and session storage
  console.log('[Logout] Clearing local storage and session storage...');
  clearGoogleTokens();

  // Clear mnemonic from memory
  const { clearMnemonic } = await import('./mnemonicManager');
  clearMnemonic();

  sessionStorage.clear();
  console.log('[Logout] Logout process complete');
}

/**
 * Get CSRF token from cookie (readable by JavaScript)
 */
export function getCsrfToken(): string | null {
  const name = 'zerodrive_csrf=';
  const cookies = document.cookie.split(';');
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
  const hasCookies = document.cookie.includes('zerodrive_csrf');

  if (!hasCookies) {
    return false;
  }

  try {
    const response = await apiClient.get<{ email: string; emailHash: string }>('/auth/me');
    return response.success && !!response.data?.email;
  } catch (error) {
    console.error('[Auth] Authentication check failed:', error);
    return false;
  }
}

/**
 * Get user email from backend /me endpoint
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const response = await apiClient.get<{ email: string; emailHash: string }>('/auth/me');
    return response.data?.email || null;
  } catch (error) {
    console.error('Failed to get user email:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token cookie
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send refresh token cookie
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

/**
 * Check if cached Google token is valid for the given user
 */
function isGoogleTokenCacheValid(userEmail: string): boolean {
  if (!googleTokenCache) {
    return false;
  }

  // Check if cache is for the same user
  if (googleTokenCache.userEmail !== userEmail) {
    return false;
  }

  // Check if token is expired
  return Date.now() < googleTokenCache.expiry.getTime();
}

/**
 * Refresh Google access token using refresh token
 * @returns Access token if successful, 'NO_REFRESH_TOKEN' if missing, null if refresh failed
 */
async function refreshGoogleAccessToken(userEmail: string): Promise<string | 'NO_REFRESH_TOKEN' | null> {
  try {
    const storedData = sessionStorage.getItem('google-tokens');
    if (!storedData) {
      console.log('[Auth] No tokens to refresh');
      return null;
    }

    const parsed = JSON.parse(storedData);
    if (!parsed.refreshToken) {
      console.warn('[Auth] No refresh token available - cannot refresh access token');
      console.log('[Auth] User will need to re-authenticate to get a new refresh token');
      return 'NO_REFRESH_TOKEN';
    }

    console.log('[Auth] Attempting to refresh Google access token...');
    const response = await fetch(`${API_URL}/auth/google/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        refreshToken: parsed.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('[Auth] Token refresh failed with status:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.accessToken || !data.expiresAt) {
      console.error('[Auth] Invalid refresh response:', data);
      return null;
    }

    // Store new tokens
    await storeGoogleTokens(
      {
        accessToken: data.accessToken,
        refreshToken: parsed.refreshToken, // Keep same refresh token
        expiresAt: new Date(data.expiresAt),
        scope: parsed.scope,
      },
      userEmail
    );

    console.log('[Auth] Google access token refreshed successfully');
    return data.accessToken;
  } catch (error) {
    console.error('[Auth] Error refreshing Google token:', error);
    return null;
  }
}

/**
 * Get Google access token from sessionStorage
 */
export async function getGoogleTokenFromStorage(userEmail: string): Promise<string | null> {
  try {
    const storedData = sessionStorage.getItem('google-tokens');
    if (!storedData) {
      console.log('[Auth] No Google tokens found in sessionStorage');
      return null;
    }

    const parsed = JSON.parse(storedData);

    // Check if tokens are for the correct user
    if (parsed.userEmail !== userEmail) {
      console.warn('[Auth] Stored tokens are for different user, clearing');
      clearGoogleTokens();
      return null;
    }

    // Check if token is expired
    const expiresAt = new Date(parsed.expiresAt);
    const now = Date.now();
    if (now >= expiresAt.getTime()) {
      console.log('[Auth] Access token expired, attempting refresh...');

      // Try to refresh the token before clearing
      const refreshResult = await refreshGoogleAccessToken(userEmail);

      if (refreshResult === 'NO_REFRESH_TOKEN') {
        // No refresh token available - need to re-authenticate
        console.warn('[Auth] Cannot refresh without refresh token - redirecting to login');
        console.log('[Auth] Clearing tokens and redirecting to re-authenticate...');
        clearGoogleTokens();

        // Redirect to login to get fresh tokens with refresh token
        window.location.href = '/';
        return null;
      }

      if (refreshResult) {
        // Refresh successful
        console.log('[Auth] Token refreshed successfully, continuing...');
        return refreshResult;
      }

      // Refresh failed for other reasons, clear tokens
      console.error('[Auth] Token refresh failed, clearing tokens');
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
    console.error('[Auth] Error reading Google tokens:', error);
    clearGoogleTokens();
    return null;
  }
}

/**
 * Get Google token (from cache or retrieve from sessionStorage)
 */
export async function getOrFetchGoogleToken(): Promise<string | null> {
  // Get current user email
  const userEmail = await getUserEmail();
  if (!userEmail) {
    console.error('Cannot get Google token: user not authenticated');
    return null;
  }

  // Check if we have a valid cached token in memory
  if (isGoogleTokenCacheValid(userEmail)) {
    return googleTokenCache!.token;
  }

  // Token expired or not in cache, try to get from sessionStorage
  return await getGoogleTokenFromStorage(userEmail);
}

/**
 * Store Google OAuth tokens in sessionStorage (unencrypted)
 * SessionStorage is cleared when tab closes, providing adequate security
 */
export async function storeGoogleTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}, userEmail: string): Promise<void> {
  try {
    // Update memory cache for performance
    googleTokenCache = {
      token: tokens.accessToken,
      expiry: tokens.expiresAt,
      userEmail,
    };

    // Store tokens unencrypted in sessionStorage
    // sessionStorage is cleared when tab closes, providing adequate security
    const stored = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
      userEmail,
    };
    sessionStorage.setItem('google-tokens', JSON.stringify(stored));
    console.log('[Auth] Stored Google tokens in sessionStorage', {
      hasRefreshToken: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });

    if (!tokens.refreshToken) {
      console.warn('[Auth] No refresh token provided - token refresh will not be possible when access token expires');
      console.log('[Auth] User may need to re-authenticate after 1 hour when access token expires');
    }
  } catch (error) {
    console.error('[Auth] Failed to store Google tokens:', error);
    throw error;
  }
}

/**
 * Clear Google tokens from memory cache and sessionStorage
 */
export function clearGoogleTokens(): void {
  googleTokenCache = null;
  sessionStorage.removeItem('google-tokens');
}

/**
 * Check if Google tokens exist in sessionStorage
 * @returns true if tokens exist, false otherwise
 */
export function hasGoogleTokensInStorage(): boolean {
  const storedData = sessionStorage.getItem('google-tokens');
  return storedData !== null;
}
