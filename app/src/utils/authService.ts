/**
 * Authentication Service
 * Handles JWT token management and authentication flow
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'zerodrive_auth_token';
const GOOGLE_TOKEN_KEY = 'zerodrive_google_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'zerodrive_google_token_expiry';

/**
 * Initiate login by redirecting to backend OAuth
 */
export function login(): void {
  window.location.href = `${API_URL}/api/auth/google`;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const token = getToken();

  // Clear tokens locally
  localStorage.removeItem(TOKEN_KEY);
  clearGoogleTokens();
  sessionStorage.clear();

  // Call backend logout endpoint (best effort)
  if (token) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with local logout even if backend fails
    }
  }
}

/**
 * Store JWT token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) {
    return false;
  }

  // Basic check: decode JWT and check expiry
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() < expiryTime;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return false;
  }
}

/**
 * Get user email from JWT (client-side decode, for display only)
 */
export function getUserEmail(): string | null {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Verify token with backend (optional, for extra security)
 */
export async function verifyToken(token?: string): Promise<boolean> {
  const tokenToVerify = token || getToken();
  if (!tokenToVerify) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: tokenToVerify }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success && data.data?.valid === true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

/**
 * Store Google access token
 */
export function setGoogleToken(accessToken: string, expiresAt: string): void {
  localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
  localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, expiresAt);
}

/**
 * Get stored Google access token
 */
export function getGoogleToken(): string | null {
  return localStorage.getItem(GOOGLE_TOKEN_KEY);
}

/**
 * Check if Google token is expired
 */
export function isGoogleTokenExpired(): boolean {
  const expiryStr = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
  if (!expiryStr) {
    return true;
  }

  try {
    const expiryTime = new Date(expiryStr).getTime();
    // Check if date is valid (NaN means invalid date)
    if (isNaN(expiryTime)) {
      return true;
    }
    return Date.now() >= expiryTime;
  } catch (error) {
    console.error('Failed to parse Google token expiry:', error);
    return true;
  }
}

/**
 * Fetch Google access token from backend
 */
export async function fetchGoogleToken(): Promise<string | null> {
  const jwtToken = getToken();
  if (!jwtToken) {
    console.error('No JWT token found');
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/google-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Google token:', response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      // Store token locally
      setGoogleToken(data.data.accessToken, data.data.expiresAt);
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
  // Check if we have a valid cached token
  const cachedToken = getGoogleToken();
  if (cachedToken && !isGoogleTokenExpired()) {
    return cachedToken;
  }

  // Token expired or not found, fetch from backend
  return await fetchGoogleToken();
}

/**
 * Clear Google tokens
 */
export function clearGoogleTokens(): void {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
}
