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
      expect(response.headers.location).toBe('http://localhost:3000/oauth/callback');

      // Verify cookies were set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('zerodrive_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('zerodrive_refresh='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('zerodrive_csrf='))).toBe(true);

      // Verify Google tokens were stored
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_google_tokens'),
        expect.arrayContaining([mockUserEmail, mockAccessToken])
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

  describe('GET /api/auth/google-token', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            access_token: 'google-token',
            refresh_token: 'google-refresh',
            token_expiry: new Date(Date.now() + 3600000), // 1 hour from now
            scope: 'https://www.googleapis.com/auth/drive',
          },
        ],
      });
    });

    it('should return Google token when authenticated', async () => {
      const userEmail = 'test@example.com';
      const token = generateToken(userEmail);

      const response = await request(app)
        .get('/api/auth/google-token')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe('google-token');
      expect(response.body.data.scope).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/google-token');

      expect(response.status).toBe(401);
    });

    it('should refresh expired Google token if refresh token available', async () => {
      const userEmail = 'test@example.com';
      const token = generateToken(userEmail);

      // Mock expired token
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            access_token: 'expired-token',
            refresh_token: 'google-refresh',
            token_expiry: new Date(Date.now() - 3600000), // Expired
            scope: 'https://www.googleapis.com/auth/drive',
          },
        ],
      });

      // Mock successful refresh
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: 'new-google-token',
      });

      // Mock database update
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/google-token')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe('new-google-token');
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('google-refresh');
    });

    it('should return 404 when no Google token found', async () => {
      const userEmail = 'test@example.com';
      const token = generateToken(userEmail);

      mockQuery.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/auth/google-token')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('No Google token found');
    });
  });
});
