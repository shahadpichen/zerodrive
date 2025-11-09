/**
 * Unit Tests for Auth Service (Frontend)
 * Tests cookie-based authentication and token management
 */

import {
  isAuthenticated,
  getUserEmail,
  logout,
  getCsrfToken,
  setGoogleToken,
  getGoogleToken,
  isGoogleTokenExpired,
} from '../../utils/authService';

// Mock fetch globally
global.fetch = jest.fn();

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

describe('AuthService', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    // Clear cookies
    document.cookie = '';
  });

  describe('isAuthenticated', () => {
    it('should return false when no CSRF cookie exists', async () => {
      document.cookie = '';

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return true when /auth/me returns 200', async () => {
      document.cookie = 'zerodrive_csrf=test-csrf-token';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await isAuthenticated();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should return false when /auth/me returns 401', async () => {
      document.cookie = 'zerodrive_csrf=test-csrf-token';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false when /auth/me request fails', async () => {
      document.cookie = 'zerodrive_csrf=test-csrf-token';
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getUserEmail', () => {
    it('should return email from /auth/me endpoint', async () => {
      const email = 'test@example.com';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { email },
        }),
      });

      const result = await getUserEmail();

      expect(result).toBe(email);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should return null when /auth/me returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await getUserEmail();

      expect(result).toBeNull();
    });

    it('should return null when request fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await getUserEmail();

      expect(result).toBeNull();
    });

    it('should return null when response has no email', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {},
        }),
      });

      const result = await getUserEmail();

      expect(result).toBeNull();
    });
  });

  describe('getCsrfToken', () => {
    it('should extract CSRF token from cookie', () => {
      document.cookie = 'zerodrive_csrf=test-csrf-token';

      const token = getCsrfToken();

      expect(token).toBe('test-csrf-token');
    });

    it('should return null when no CSRF cookie exists', () => {
      document.cookie = '';

      const token = getCsrfToken();

      expect(token).toBeNull();
    });

    it('should extract CSRF token from multiple cookies', () => {
      document.cookie = 'other_cookie=value; zerodrive_csrf=my-token; another=cookie';

      const token = getCsrfToken();

      expect(token).toBe('my-token');
    });
  });

  describe('logout', () => {
    it('should clear sessionStorage', async () => {
      sessionStorage.setItem('test-key', 'test-value');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      await logout();

      expect(sessionStorage.getItem('test-key')).toBeNull();
    });

    it('should clear Google tokens from localStorage', async () => {
      localStorage.setItem('zerodrive_google_token', 'google-token');
      localStorage.setItem('zerodrive_google_token_expiry', 'expiry');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      await logout();

      expect(localStorage.getItem('zerodrive_google_token')).toBeNull();
      expect(localStorage.getItem('zerodrive_google_token_expiry')).toBeNull();
    });

    it('should call backend logout endpoint with CSRF token', async () => {
      document.cookie = 'zerodrive_csrf=test-csrf-token';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token',
          }),
          credentials: 'include',
        })
      );
    });

    it('should continue logout even if backend call fails', async () => {
      sessionStorage.setItem('test-key', 'test-value');

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await logout();

      // Should still clear session storage even if backend fails
      expect(sessionStorage.getItem('test-key')).toBeNull();
    });

    it('should handle missing CSRF token gracefully', async () => {
      document.cookie = '';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  describe('Google Token Management', () => {
    it('should store Google token and expiry', () => {
      const token = 'google-access-token';
      const expiry = new Date(Date.now() + 3600000).toISOString();

      setGoogleToken(token, expiry);

      expect(localStorage.getItem('zerodrive_google_token')).toBe(token);
      expect(localStorage.getItem('zerodrive_google_token_expiry')).toBe(expiry);
    });

    it('should retrieve stored Google token', () => {
      const token = 'google-access-token';
      localStorage.setItem('zerodrive_google_token', token);

      const retrieved = getGoogleToken();

      expect(retrieved).toBe(token);
    });

    it('should return null when no Google token stored', () => {
      const retrieved = getGoogleToken();

      expect(retrieved).toBeNull();
    });
  });

  describe('isGoogleTokenExpired', () => {
    it('should return false for valid future expiry', () => {
      const futureExpiry = new Date(Date.now() + 3600000).toISOString();
      localStorage.setItem('zerodrive_google_token_expiry', futureExpiry);

      expect(isGoogleTokenExpired()).toBe(false);
    });

    it('should return true for past expiry', () => {
      const pastExpiry = new Date(Date.now() - 3600000).toISOString();
      localStorage.setItem('zerodrive_google_token_expiry', pastExpiry);

      expect(isGoogleTokenExpired()).toBe(true);
    });

    it('should return true when no expiry stored', () => {
      expect(isGoogleTokenExpired()).toBe(true);
    });

    it('should return true for invalid expiry format', () => {
      localStorage.setItem('zerodrive_google_token_expiry', 'invalid-date');

      expect(isGoogleTokenExpired()).toBe(true);
    });
  });
});
