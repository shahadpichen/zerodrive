/**
 * Unit Tests for Auth Service (Frontend)
 * Tests JWT token management and authentication state
 */

import {
  setToken,
  getToken,
  isAuthenticated,
  getUserEmail,
  logout,
  setGoogleToken,
  getGoogleToken,
  isGoogleTokenExpired,
} from '../../utils/authService';

// Mock fetch globally
global.fetch = jest.fn();

describe('AuthService', () => {
  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('JWT Token Management', () => {
    it('should store JWT token in localStorage', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

      setToken(token);

      expect(localStorage.getItem('zerodrive_auth_token')).toBe(token);
    });

    it('should retrieve stored JWT token', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      localStorage.setItem('zerodrive_auth_token', token);

      const retrieved = getToken();

      expect(retrieved).toBe(token);
    });

    it('should return null when no token stored', () => {
      const retrieved = getToken();

      expect(retrieved).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for valid non-expired token', () => {
      // Create a token that expires in 1 hour
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const payload = btoa(JSON.stringify({ exp: futureTime }));
      const token = `header.${payload}.signature`;

      localStorage.setItem('zerodrive_auth_token', token);

      expect(isAuthenticated()).toBe(true);
    });

    it('should return false for expired token', () => {
      // Create a token that expired 1 hour ago
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      const payload = btoa(JSON.stringify({ exp: pastTime }));
      const token = `header.${payload}.signature`;

      localStorage.setItem('zerodrive_auth_token', token);

      expect(isAuthenticated()).toBe(false);
    });

    it('should return false when no token exists', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false for malformed token', () => {
      localStorage.setItem('zerodrive_auth_token', 'invalid.token');

      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('getUserEmail', () => {
    it('should extract email from JWT payload', () => {
      const email = 'test@example.com';
      const payload = btoa(JSON.stringify({ email }));
      const token = `header.${payload}.signature`;

      localStorage.setItem('zerodrive_auth_token', token);

      expect(getUserEmail()).toBe(email);
    });

    it('should return null when no token exists', () => {
      expect(getUserEmail()).toBeNull();
    });

    it('should return null for invalid token', () => {
      localStorage.setItem('zerodrive_auth_token', 'invalid');

      expect(getUserEmail()).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear JWT token from localStorage', async () => {
      localStorage.setItem('zerodrive_auth_token', 'test-token');
      sessionStorage.setItem('test-session', 'value');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await logout();

      expect(localStorage.getItem('zerodrive_auth_token')).toBeNull();
    });

    it('should clear sessionStorage', async () => {
      sessionStorage.setItem('test-key', 'test-value');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await logout();

      expect(sessionStorage.getItem('test-key')).toBeNull();
    });

    it('should call backend logout endpoint', async () => {
      const token = 'test-token';
      localStorage.setItem('zerodrive_auth_token', token);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it('should continue logout even if backend call fails', async () => {
      localStorage.setItem('zerodrive_auth_token', 'test-token');

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await logout();

      // Should still clear local storage even if backend fails
      expect(localStorage.getItem('zerodrive_auth_token')).toBeNull();
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
