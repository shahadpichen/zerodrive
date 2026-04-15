/**
 * Integration Tests for Auth Routes
 * Tests authentication endpoints with cookies and CSRF tokens
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import authRouter from '../../routes/auth';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';
import { generateToken, generateRefreshToken } from '../../services/jwtService';

// Mock dependencies
jest.mock('../../services/googleOAuthService');
jest.mock('../../config/database');
jest.mock('../../services/analytics');

const mockQuery = jest.fn();
jest.mock('../../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockGetAuthUrl = jest.fn();
const mockGetTokensFromCode = jest.fn();
const mockGetUserInfo = jest.fn();
const mockHasFullDriveScope = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock('../../services/googleOAuthService', () => ({
  getAuthUrl: (...args: any[]) => mockGetAuthUrl(...args),
  getTokensFromCode: (...args: any[]) => mockGetTokensFromCode(...args),
  getUserInfo: (...args: any[]) => mockGetUserInfo(...args),
  hasFullDriveScope: (...args: any[]) => mockHasFullDriveScope(...args),
  refreshAccessToken: (...args: any[]) => mockRefreshAccessToken(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('../../services/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    USER_LOGIN_NEW: 'user_login_new',
    USER_LOGIN_EXISTING: 'user_login_existing',
    USER_LOGIN_LIMITED_SCOPE: 'user_login_limited_scope',
  },
  AnalyticsCategory: {
    AUTH: 'auth',
  },
}));

describe('Auth Routes Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  describe('GET /api/auth/google', () => {
    it('should redirect to Google OAuth URL', async () => {
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?...';
      mockGetAuthUrl.mockReturnValue(authUrl);

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(authUrl);
      expect(mockGetAuthUrl).toHaveBeenCalled();
    });

    it('should redirect to frontend with error if OAuth init fails', async () => {
      mockGetAuthUrl.mockImplementation(() => {
        throw new Error('OAuth config error');
      });

      const response = await request(app).get('/api/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=oauth_init_failed');
    });
  });

  describe('GET /api/auth/callback/google', () => {
    const mockCode = 'mock-oauth-code';
    const mockAccessToken = 'mock-google-access-token';
    const mockRefreshToken = 'mock-google-refresh-token';
    const mockUserEmail = 'test@example.com';

    beforeEach(() => {
      mockGetTokensFromCode.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        scope: 'https://www.googleapis.com/auth/drive',
      });

      mockGetUserInfo.mockResolvedValue({
        email: mockUserEmail,
        verified: true,
      });

      mockHasFullDriveScope.mockReturnValue(true);

      // Mock database query - no existing public key (new user)
      mockQuery.mockResolvedValue({ rows: [] });
    });

    it('should handle successful OAuth callback for new user', async () => {
      const response = await request(app)
        .get('/api/auth/callback/google')
        .query({ code: mockCode });

      expect(response.status).toBe(302);

      // Verify redirect includes tokens in URL (zero-knowledge architecture)
      const redirectUrl = response.headers.location as string;
      expect(redirectUrl).toContain('http://localhost:3000/oauth/callback');
      expect(redirectUrl).toContain('tokens='); // Base64-encoded tokens
      expect(redirectUrl).toContain('new=true'); // New user flag
      expect(redirectUrl).toContain('limited=false'); // Full scope granted

      // Verify cookies were set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('zerodrive_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('zerodrive_refresh='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('zerodrive_csrf='))).toBe(true);

      // Google tokens are NO LONGER stored in database (zero-knowledge architecture)
      // They are passed once via URL redirect to frontend, which encrypts them client-side
      // Verify that we only query for existing user (public_keys check), not insert tokens
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user_id FROM public_keys'),
        expect.arrayContaining([mockUserEmail])
      );

      // Verify analytics tracked
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it('should handle existing user login', async () => {
      // Mock existing public key (existing user)
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: mockUserEmail }],
      });

      mockQuery.mockResolvedValueOnce({ rows: [] }); // For token upsert

      const response = await request(app)
        .get('/api/auth/callback/google')
        .query({ code: mockCode });

      expect(response.status).toBe(302);
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it('should redirect with error when no code provided', async () => {
      const response = await request(app).get('/api/auth/callback/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=no_code');
    });

    it('should redirect with error when OAuth error in query', async () => {
      const response = await request(app)
        .get('/api/auth/callback/google')
        .query({ error: 'access_denied' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=access_denied');
    });

    it('should redirect with error when email is not verified', async () => {
      mockGetUserInfo.mockResolvedValue({
        email: mockUserEmail,
        verified: false,
      });

      const response = await request(app)
        .get('/api/auth/callback/google')
        .query({ code: mockCode });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=email_not_verified');
    });

    it('should set httpOnly cookies with correct attributes', async () => {
      const response = await request(app)
        .get('/api/auth/callback/google')
        .query({ code: mockCode });

      const cookies = response.headers['set-cookie'] as unknown as string[];

      const tokenCookie = cookies.find((c: string) => c.startsWith('zerodrive_token='));
      expect(tokenCookie).toContain('HttpOnly');
      expect(tokenCookie).toContain('SameSite=Lax');
      expect(tokenCookie).toContain('Path=/');

      const csrfCookie = cookies.find((c: string) => c.startsWith('zerodrive_csrf='));
      expect(csrfCookie).not.toContain('HttpOnly'); // CSRF should NOT be httpOnly
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info when authenticated', async () => {
      const userEmail = 'test@example.com';
      const token = generateToken(userEmail);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userEmail);
      expect(response.body.data.emailHash).toBeDefined();
    });

    it('should return 401 when no token cookie provided', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['zerodrive_token=invalid.token.here']);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const userEmail = 'test@example.com';
      const refreshToken = generateRefreshToken(userEmail);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`zerodrive_refresh=${refreshToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new access token cookie was set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('zerodrive_token='))).toBe(true);
    });

    it('should return 401 when no refresh token provided', async () => {
      const response = await request(app).post('/api/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('No refresh token');
    });

    it('should return 401 when refresh token is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['zerodrive_refresh=invalid.token.here']);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear all auth cookies', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify cookies were cleared
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();

      const tokenCookie = cookies.find((c: string) => c.includes('zerodrive_token='));
      const refreshCookie = cookies.find((c: string) => c.includes('zerodrive_refresh='));
      const csrfCookie = cookies.find((c: string) => c.includes('zerodrive_csrf='));

      // Cleared cookies should have expired date
      expect(tokenCookie).toContain('Thu, 01 Jan 1970');
      expect(refreshCookie).toContain('Thu, 01 Jan 1970');
      expect(csrfCookie).toContain('Thu, 01 Jan 1970');
    });

    it('should succeed even without auth cookie', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
    });
  });

  // ENDPOINT REMOVED: /api/auth/google-token (Risk #35 - Zero-knowledge architecture)
  // Google tokens are now encrypted client-side and never stored in database
  // Backend passes tokens once via URL redirect during OAuth callback
  // See: backend/src/routes/auth.ts (lines 140-151)
  // See: app/src/utils/authService.ts (storeGoogleTokens function)
  //
  // describe('GET /api/auth/google-token', () => {
  //   // Tests removed - endpoint no longer exists
  // });

  describe('POST /api/auth/google/refresh', () => {
    const mockGoogleRefreshToken = 'mock-google-refresh-token';
    const mockNewAccessToken = 'mock-new-google-access-token';

    beforeEach(() => {
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });
    });

    it('should refresh Google access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe(mockNewAccessToken);
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.message).toBe('Google access token refreshed');

      expect(mockRefreshAccessToken).toHaveBeenCalledWith(mockGoogleRefreshToken);
    });

    it('should return valid ISO timestamp for expiry', async () => {
      const beforeRequest = new Date();
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });
      const afterRequest = new Date(Date.now() + 3600 * 1000); // +1 hour

      expect(response.status).toBe(200);
      expect(response.body.data.expiresAt).toBeDefined();

      const expiresAt = new Date(response.body.data.expiresAt);
      expect(expiresAt.toISOString()).toBe(response.body.data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(beforeRequest.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should calculate expiry approximately 1 hour from now', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      const expiresAt = new Date(response.body.data.expiresAt);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600 * 1000);

      // Allow 1 second tolerance for test execution time
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(oneHourFromNow.getTime() - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(oneHourFromNow.getTime() + 1000);
    });

    it('should return 400 when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Refresh token is required');
    });

    it('should return 400 when refresh token is null', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: null });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Refresh token is required');
    });

    it('should return 400 when refresh token is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Refresh token is required');
    });

    it('should return 400 when refresh token is an empty string', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Refresh token is required');
    });

    it('should return 401 when Google refresh fails', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Failed to refresh Google access token');
    });

    it('should return 401 when refresh token is expired', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Token has been expired or revoked'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when refresh token is revoked', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Token has been revoked'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should not require JWT authentication cookie', async () => {
      // No zerodrive_token cookie provided
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle whitespace-only refresh token', async () => {
      // Whitespace-only string passes validation but fails at Google OAuth level
      mockRefreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: '   ' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle request with extra fields', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({
          refreshToken: mockGoogleRefreshToken,
          extraField: 'should-be-ignored',
          anotherField: 123,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockRefreshAccessToken).toHaveBeenCalledWith(mockGoogleRefreshToken);
    });

    it('should handle special characters in refresh token', async () => {
      const specialToken = 'token-with-special-chars-!@#$%^&*()';
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: specialToken });

      expect(response.status).toBe(200);
      expect(mockRefreshAccessToken).toHaveBeenCalledWith(specialToken);
    });

    it('should handle very long refresh token', async () => {
      const longToken = 'a'.repeat(1000);
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: longToken });

      expect(response.status).toBe(200);
      expect(mockRefreshAccessToken).toHaveBeenCalledWith(longToken);
    });

    it('should handle Google API rate limit error', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Rate limit exceeded'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle network error during refresh', async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle malformed JSON body gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .set('Content-Type', 'application/json')
        .send('{"refreshToken": invalid}');

      expect(response.status).toBe(400);
    });

    it('should handle array instead of object', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send([mockGoogleRefreshToken]);

      expect(response.status).toBe(400);
    });

    it('should return different access tokens on repeated calls', async () => {
      mockRefreshAccessToken
        .mockResolvedValueOnce({ accessToken: 'token-1' })
        .mockResolvedValueOnce({ accessToken: 'token-2' });

      const response1 = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      const response2 = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response1.body.data.accessToken).toBe('token-1');
      expect(response2.body.data.accessToken).toBe('token-2');
    });

    it('should handle Google OAuth service throwing non-Error object', async () => {
      mockRefreshAccessToken.mockRejectedValue('string error');

      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: mockGoogleRefreshToken });

      expect(response.status).toBe(401);
    });

    it('should handle undefined refreshToken field', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send({ refreshToken: undefined });

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/google/refresh')
        .send();

      expect(response.status).toBe(400);
    });
  });
});
