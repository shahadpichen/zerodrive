/**
 * Authentication Service
 * Handles JWT token management and authentication flow
 */

import { encryptGoogleTokens, decryptGoogleTokens } from './cryptoUtils';
import { hasMnemonic } from './mnemonicManager';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// JWT token is now stored in httpOnly cookie, not localStorage
// Google tokens are encrypted in sessionStorage with PBKDF2 (same as AES/RSA keys)
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
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include', // Send cookies
    });
    return response.ok;
  } catch (error) {
    console.error('[Auth] Check failed with error:', error);
    return false;
  }
}

/**
 * Get user email from backend /me endpoint
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.email || null;
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
 * Get Google access token from sessionStorage
 * Handles both encrypted (with mnemonic) and unencrypted (temporary) formats
 */
export async function getGoogleTokenFromStorage(userEmail: string): Promise<string | null> {
  try {
    const storedData = sessionStorage.getItem('google-tokens-encrypted');
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

    // Check if tokens are unencrypted (temporary storage during OAuth)
    if (parsed.needsEncryption === true) {
      console.warn('[Auth] Using unencrypted Google tokens (mnemonic not yet entered)');

      // Check if token is expired
      const expiresAt = new Date(parsed.expiresAt);
      const now = Date.now();
      if (now >= expiresAt.getTime()) {
        console.log('[Auth] Access token expired');
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
    }

    // Tokens are encrypted - decrypt them
    const tokens = await decryptGoogleTokens({
      iv: parsed.iv,
      encryptedTokens: parsed.encryptedTokens,
    });

    // Check if token is expired
    const now = Date.now();
    if (now >= tokens.expiresAt.getTime()) {
      console.log('[Auth] Access token expired');

      // TODO: Implement token refresh using refresh_token
      // For now, return null and user will need to re-authenticate
      if (tokens.refreshToken) {
        console.warn('[Auth] Token refresh not yet implemented, clearing tokens');
        clearGoogleTokens();
      }

      return null;
    }

    // Update memory cache
    googleTokenCache = {
      token: tokens.accessToken,
      expiry: tokens.expiresAt,
      userEmail,
    };

    return tokens.accessToken;
  } catch (error) {
    console.error('[Auth] Error reading Google tokens:', error);
    // If decryption fails (e.g., wrong mnemonic), clear the storage
    clearGoogleTokens();
    return null;
  }
}

/**
 * Get Google token (from cache or decrypt from sessionStorage)
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
 * Store Google OAuth tokens in sessionStorage
 * If mnemonic is available: Encrypts with PBKDF2 before storing
 * If mnemonic NOT available: Stores unencrypted temporarily (auto-encrypted when mnemonic entered)
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

    // Check if mnemonic is available
    if (hasMnemonic()) {
      // Encrypt tokens with PBKDF2-derived key from mnemonic
      const encryptedData = await encryptGoogleTokens(tokens);

      // Store in sessionStorage (encrypted)
      const stored = {
        ...encryptedData,
        userEmail,
      };
      sessionStorage.setItem('google-tokens-encrypted', JSON.stringify(stored));
      console.log('[Auth] Stored encrypted Google tokens in sessionStorage');
    } else {
      // No mnemonic yet - store unencrypted temporarily
      // This happens during OAuth before user sets up keys
      // Tokens will be encrypted automatically when mnemonic is entered
      const stored = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt.toISOString(),
        scope: tokens.scope,
        userEmail,
        needsEncryption: true, // Flag to encrypt later
      };
      sessionStorage.setItem('google-tokens-encrypted', JSON.stringify(stored));
      console.warn('[Auth] Stored UNENCRYPTED Google tokens in sessionStorage (will encrypt when mnemonic available)');
    }
  } catch (error) {
    console.error('[Auth] Failed to store Google tokens:', error);
    throw error;
  }
}

/**
 * Encrypt pending Google tokens if they were stored unencrypted
 * Called automatically when mnemonic is entered
 * @returns true if tokens were encrypted, false if no pending tokens
 */
export async function encryptPendingGoogleTokens(): Promise<boolean> {
  try {
    const storedData = sessionStorage.getItem('google-tokens-encrypted');
    if (!storedData) {
      return false; // No tokens to encrypt
    }

    const parsed = JSON.parse(storedData);

    // Check if tokens need encryption
    if (parsed.needsEncryption !== true) {
      return false; // Already encrypted or not flagged
    }

    console.log('[Auth] Encrypting pending Google tokens...');

    // Extract token data
    const tokens = {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: new Date(parsed.expiresAt),
      scope: parsed.scope,
    };

    // Re-store with encryption (will use mnemonic now available)
    await storeGoogleTokens(tokens, parsed.userEmail);

    console.log('[Auth] Successfully encrypted pending Google tokens');
    return true;
  } catch (error) {
    console.error('[Auth] Failed to encrypt pending Google tokens:', error);
    return false;
  }
}

/**
 * Clear Google tokens from memory cache and sessionStorage
 */
export function clearGoogleTokens(): void {
  googleTokenCache = null;
  sessionStorage.removeItem('google-tokens-encrypted');
}
