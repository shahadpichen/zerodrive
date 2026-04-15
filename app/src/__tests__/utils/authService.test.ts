/**
 * Unit Tests for Auth Service (Frontend)
 * Tests cookie-based authentication and token management
 */

import {
  isAuthenticated,
  getUserEmail,
  logout,
  getCsrfToken,
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

    it('should clear memory cache and session storage', async () => {
      sessionStorage.setItem('test-key', 'test-value');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      await logout();

      // Session storage should be cleared
      expect(sessionStorage.getItem('test-key')).toBeNull();
      // Note: Memory cache (Google tokens and mnemonic) is cleared but not directly testable
      // from this test due to module isolation
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

  // Note: Google token management has been moved to memory cache
  // and is no longer exposed as public functions. Testing is done
  // through integration tests of getOrFetchGoogleToken().
});
