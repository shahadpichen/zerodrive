/**
 * Authentication Service
 * Handles JWT token management and authentication flow
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// JWT token is now stored in httpOnly cookie, not localStorage
// Google tokens are cached in memory (not localStorage) for security
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
 * Fetch Google access token from backend
 */
export async function fetchGoogleToken(userEmail: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/google-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Send JWT token cookie
    });

    if (!response.ok) {
      console.error('Failed to fetch Google token:', response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      // Cache token in memory
      googleTokenCache = {
        token: data.data.accessToken,
        expiry: new Date(data.data.expiresAt),
        userEmail: userEmail,
      };
      return data.data.accessToken;
    }

    return null;
  } catch (error) {
    console.error('Error fetching Google token:', error);
    return null;
  }
}

/**
 * Get Google token (from cache or fetch from backend)
 */
export async function getOrFetchGoogleToken(): Promise<string | null> {
  // Get current user email
  const userEmail = await getUserEmail();
  if (!userEmail) {
    console.error('Cannot get Google token: user not authenticated');
    return null;
  }

  // Check if we have a valid cached token
  if (isGoogleTokenCacheValid(userEmail)) {
    return googleTokenCache!.token;
  }

  // Token expired or not found, fetch from backend
  return await fetchGoogleToken(userEmail);
}

/**
 * Clear Google tokens from memory cache
 */
export function clearGoogleTokens(): void {
  googleTokenCache = null;
}
