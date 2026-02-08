/**
 * Integration Tests for Analytics Routes
 * Tests analytics endpoints with authentication and validation
 */

import request from 'supertest';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import analyticsRouter from '../../routes/analytics';
import { responseHelpers, errorHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { generateToken } from '../../services/jwtService';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/analytics');

const mockQuery = jest.fn();
jest.mock('../../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockGetAnalyticsSummary = jest.fn();
const mockGetDailyStats = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('../../services/analytics', () => ({
  getAnalyticsSummary: (...args: any[]) => mockGetAnalyticsSummary(...args),
  getDailyStats: (...args: any[]) => mockGetDailyStats(...args),
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    USER_LOGIN: 'user_login',
    USER_LOGIN_NEW: 'user_login_new',
    USER_LOGIN_EXISTING: 'user_login_existing',
    FILE_ADDED_TO_DRIVE: 'file_added_to_drive',
    FILE_SHARED: 'file_shared',
    INVITATION_SENT: 'invitation_sent',
    SHARED_FILE_ACCESSED: 'shared_file_accessed',
  },
  AnalyticsCategory: {
    AUTH: 'auth',
    FILES: 'files',
    SHARING: 'sharing',
  },
}));

describe('Analytics Routes Integration', () => {
  let app: Application;
  const testUserEmail = 'test@example.com';
  const csrfToken = 'test-csrf-token';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use(requireAuth);
    app.use('/api/analytics', analyticsRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('should return analytics summary with default 30 days when authenticated', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 150,
        eventsByType: {
          'user_login': 50,
          'user_login_new': 10,
          'file_added_to_drive': 40,
          'file_shared': 30,
          'invitation_sent': 20,
        },
        eventsByCategory: {
          'auth': 60,
          'files': 40,
          'sharing': 50,
        },
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
      expect(response.body.message).toContain('30 days');

      // Verify service called with correct date range
      expect(mockGetAnalyticsSummary).toHaveBeenCalledTimes(1);
      const [startDate, endDate] = mockGetAnalyticsSummary.mock.calls[0];
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);

      // Verify date range is approximately 30 days
      const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });

    it('should return analytics summary for custom days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 50,
        eventsByType: { 'user_login': 25, 'file_shared': 25 },
        eventsByCategory: { 'auth': 25, 'sharing': 25 },
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 7 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
      expect(response.body.message).toContain('7 days');

      // Verify service called with 7-day range
      const [startDate, endDate] = mockGetAnalyticsSummary.mock.calls[0];
      const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });

    it('should handle large days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 1000,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 365 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('365 days');
    });

    it('should handle zero days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 0 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle non-numeric days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 'invalid' })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // parseInt('invalid') returns NaN, which gets used in date calculation
      expect(mockGetAnalyticsSummary).toHaveBeenCalled();
    });

    it('should return 401 when no auth token provided', async () => {
      const response = await request(app).get('/api/analytics/summary');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
    });

    it('should return 401 when auth token is invalid', async () => {
      const response = await request(app)
        .get('/api/analytics/summary')
        .set('Cookie', ['zerodrive_token=invalid.token.here']);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockGetAnalyticsSummary.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/analytics/summary')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle empty analytics data', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEvents).toBe(0);
    });

    it('should handle negative days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: -5 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGetAnalyticsSummary).toHaveBeenCalled();
    });
  });

  describe('GET /api/analytics/daily', () => {
    it('should return daily stats with default 30 days when authenticated', async () => {
      const token = generateToken(testUserEmail);
      const mockDailyStats = [
        { date: '2024-01-10', logins: 10, filesAdded: 5, shares: 3, downloads: 7 },
        { date: '2024-01-09', logins: 8, filesAdded: 4, shares: 2, downloads: 6 },
        { date: '2024-01-08', logins: 12, filesAdded: 6, shares: 4, downloads: 8 },
      ];

      mockGetDailyStats.mockResolvedValue(mockDailyStats);

      const response = await request(app)
        .get('/api/analytics/daily')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDailyStats);
      expect(response.body.message).toContain('30 days');

      // Verify service called with default 30 days
      expect(mockGetDailyStats).toHaveBeenCalledWith(30);
    });

    it('should return daily stats for custom days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockDailyStats = [
        { date: '2024-01-10', logins: 10, filesAdded: 5, shares: 3, downloads: 7 },
      ];

      mockGetDailyStats.mockResolvedValue(mockDailyStats);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: 7 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDailyStats);
      expect(response.body.message).toContain('7 days');
      expect(mockGetDailyStats).toHaveBeenCalledWith(7);
    });

    it('should handle days parameter as 1', async () => {
      const token = generateToken(testUserEmail);
      const mockDailyStats = [
        { date: '2024-01-10', logins: 5, filesAdded: 2, shares: 1, downloads: 3 },
      ];

      mockGetDailyStats.mockResolvedValue(mockDailyStats);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: 1 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGetDailyStats).toHaveBeenCalledWith(1);
    });

    it('should handle large days parameter', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: 365 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGetDailyStats).toHaveBeenCalledWith(365);
    });

    it('should return 401 when no auth token provided', async () => {
      const response = await request(app).get('/api/analytics/daily');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockGetDailyStats).not.toHaveBeenCalled();
    });

    it('should return 401 when auth token is invalid', async () => {
      const response = await request(app)
        .get('/api/analytics/daily')
        .set('Cookie', ['zerodrive_token=invalid.token.here']);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockGetDailyStats).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/analytics/daily')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle empty daily stats', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/daily')
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should handle zero days parameter', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: 0 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGetDailyStats).toHaveBeenCalledWith(0);
    });

    it('should handle non-numeric days parameter', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: 'abc' })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // parseInt('abc') returns NaN
      expect(mockGetDailyStats).toHaveBeenCalled();
    });

    it('should handle negative days parameter', async () => {
      const token = generateToken(testUserEmail);
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({ days: -10 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockGetDailyStats).toHaveBeenCalledWith(-10);
    });
  });

  describe('POST /api/analytics/track', () => {
    it('should track event with valid data when authenticated', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tracked).toBe(true);
      expect(response.body.message).toBe('Event tracked successfully');
      expect(mockTrackEvent).toHaveBeenCalledWith('user_login', 'auth', undefined);
    });

    it('should track event with metadata', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const metadata = { source: 'web', browser: 'chrome' };

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'file_added_to_drive',
          category: 'files',
          metadata,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('file_added_to_drive', 'files', metadata);
    });

    it('should use default category when not provided', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('user_login', 'auth', undefined);
    });

    it('should track event with valid category "files"', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'file_added',
          category: 'files',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('file_added', 'files', undefined);
    });

    it('should track event with valid category "sharing"', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'file_shared',
          category: 'sharing',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('file_shared', 'sharing', undefined);
    });

    it('should return 400 when event is missing', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          category: 'auth',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('event');
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when event is empty string', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: '',
          category: 'auth',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 422 when category is invalid', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'invalid_category',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('category');
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 422 when request body is empty', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 422 when event is not a string', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 12345,
          category: 'auth',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 422 when metadata is not an object', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
          metadata: 'not-an-object',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 401 when no auth token provided', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 401 when auth token is invalid', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          'zerodrive_token=invalid.token.here',
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF token is missing from header', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF token is missing from cookie', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [`zerodrive_token=${token}`])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF tokens do not match', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          'zerodrive_csrf=cookie-token',
        ])
        .set('x-csrf-token', 'different-token')
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should return 500 on tracking service error', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockRejectedValue(new Error('Tracking service failed'));

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in event name', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login_special-chars_123',
          category: 'auth',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('user_login_special-chars_123', 'auth', undefined);
    });

    it('should handle very long event name', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const longEventName = 'a'.repeat(500);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: longEventName,
          category: 'auth',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith(longEventName, 'auth', undefined);
    });

    it('should handle complex metadata object', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const metadata = {
        source: 'web',
        browser: 'chrome',
        version: '120.0.0',
        features: { darkMode: true, language: 'en' },
        tags: ['test', 'integration'],
      };

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'file_shared',
          category: 'sharing',
          metadata,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('file_shared', 'sharing', metadata);
    });

    it('should return 422 when metadata is null', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
          metadata: null,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should handle empty metadata object', async () => {
      const token = generateToken(testUserEmail);
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
          metadata: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('user_login', 'auth', {});
    });

    it('should return 422 when metadata is an array', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
          metadata: ['item1', 'item2'],
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should handle maximum safe integer for days parameter in summary', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: Number.MAX_SAFE_INTEGER })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle fractional days parameter', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 7.5 })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('7 days'); // parseInt truncates
    });

    it('should handle multiple query parameters with days', async () => {
      const token = generateToken(testUserEmail);
      const mockSummary = {
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      };

      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ days: 7, extra: 'ignored' })
        .set('Cookie', [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject extra fields in track request body', async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post('/api/analytics/track')
        .set('Cookie', [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set('x-csrf-token', csrfToken)
        .send({
          event: 'user_login',
          category: 'auth',
          extraField: 'ignored',
          anotherField: 123,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });
});
