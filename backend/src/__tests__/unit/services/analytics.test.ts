/**
 * Unit Tests for Analytics Service
 * Tests anonymous analytics tracking and privacy measures
 */

import {
  trackEvent,
  getAnalyticsSummary,
  getDailyStats,
  getFileSizeBucket,
  getFileTypeCategory,
  AnalyticsEvent,
  AnalyticsCategory,
} from '../../../services/analytics';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockQuery = jest.fn();
jest.mock('../../../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe('trackEvent', () => {
    it('should track login event successfully', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_daily_summary')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_logins')
      );
    });

    it('should track new user login', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN_NEW, AnalyticsCategory.AUTH);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_new_users')
      );
    });

    it('should track file added event', async () => {
      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_files_added_to_drive')
      );
    });

    it('should track file shared event', async () => {
      await trackEvent(AnalyticsEvent.FILE_SHARED, AnalyticsCategory.SHARING);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_shares')
      );
    });

    it('should use upsert to increment daily counters', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (date)')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DO UPDATE SET')
      );
    });

    it('should not throw error for unknown event type', async () => {
      await expect(
        trackEvent('unknown_event' as any, AnalyticsCategory.AUTH)
      ).resolves.not.toThrow();
    });

    it('should not throw error when database fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(
        trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH)
      ).resolves.not.toThrow();
    });

    it('should strip forbidden keys from metadata', async () => {
      const metadataWithForbiddenKeys = {
        email: 'test@example.com', // Forbidden
        user_id: '123', // Forbidden
        validKey: 'valid-value',
      };

      await trackEvent(
        AnalyticsEvent.FILE_SHARED,
        AnalyticsCategory.SHARING,
        metadataWithForbiddenKeys
      );

      // Should not throw, but forbidden keys removed
      expect(metadataWithForbiddenKeys.validKey).toBe('valid-value');
    });

    it('should remove various forbidden identifiers', async () => {
      const metadata = {
        ip: '1.2.3.4',
        ipAddress: '1.2.3.4',
        session: 'abc',
        sessionId: '123',
        name: 'John',
        phone: '555-1234',
      };

      // All these should be removed
      await trackEvent(
        AnalyticsEvent.FILE_SHARED,
        AnalyticsCategory.SHARING,
        metadata
      );

      // Should not throw
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('getAnalyticsSummary', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            logins: '100',
            new_users: '20',
            limited_scope_logins: '5',
            downloads: '50',
            files_added_to_drive: '75',
            shares: '30',
            invitations: '15',
          },
        ],
      });
    });

    it('should return analytics summary for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const summary = await getAnalyticsSummary(startDate, endDate);

      expect(summary.totalEvents).toBe(295); // Sum of all events
      expect(summary.eventsByType['user_login']).toBe(100);
      expect(summary.eventsByType['user_login_new']).toBe(20);
      expect(summary.eventsByCategory['auth']).toBe(125); // 100 + 20 + 5
      expect(summary.eventsByCategory['files']).toBe(125); // 50 + 75
      expect(summary.eventsByCategory['sharing']).toBe(45); // 30 + 15
    });

    it('should query with correct date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await getAnalyticsSummary(startDate, endDate);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE date BETWEEN $1 AND $2'),
        [startDate, endDate]
      );
    });

    it('should handle null values in database response', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            logins: null,
            new_users: null,
            limited_scope_logins: null,
            downloads: null,
            files_added_to_drive: null,
            shares: null,
            invitations: null,
          },
        ],
      });

      const summary = await getAnalyticsSummary(
        new Date(),
        new Date()
      );

      expect(summary.totalEvents).toBe(0);
      expect(summary.eventsByCategory['auth']).toBe(0);
    });

    it('should throw error when database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(
        getAnalyticsSummary(new Date(), new Date())
      ).rejects.toThrow('Database error');
    });
  });

  describe('getDailyStats', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            date: '2024-01-03',
            logins: '30',
            files_added: '15',
            shares: '5',
            downloads: '10',
          },
          {
            date: '2024-01-02',
            logins: '25',
            files_added: '12',
            shares: '3',
            downloads: '8',
          },
          {
            date: '2024-01-01',
            logins: '20',
            files_added: '10',
            shares: '2',
            downloads: '5',
          },
        ],
      });
    });

    it('should return daily stats for default 30 days', async () => {
      const stats = await getDailyStats();

      expect(stats).toHaveLength(3);
      expect(stats[0].date).toBe('2024-01-03');
      expect(stats[0].logins).toBe(30);
      expect(stats[0].filesAdded).toBe(15);
    });

    it('should return daily stats for custom number of days', async () => {
      await getDailyStats(7);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
    });

    it('should handle null values in database response', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            date: '2024-01-01',
            logins: null,
            files_added: null,
            shares: null,
            downloads: null,
          },
        ],
      });

      const stats = await getDailyStats();

      expect(stats[0].logins).toBe(0);
      expect(stats[0].filesAdded).toBe(0);
    });

    it('should throw error when database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(getDailyStats()).rejects.toThrow('Database error');
    });
  });

  describe('getFileSizeBucket', () => {
    it('should return <1MB for files under 1MB', () => {
      expect(getFileSizeBucket(500 * 1024)).toBe('<1MB');
      expect(getFileSizeBucket(1024)).toBe('<1MB');
    });

    it('should return 1-10MB for files between 1-10MB', () => {
      const MB = 1024 * 1024;
      expect(getFileSizeBucket(1 * MB)).toBe('1-10MB');
      expect(getFileSizeBucket(5 * MB)).toBe('1-10MB');
      expect(getFileSizeBucket(9.9 * MB)).toBe('1-10MB');
    });

    it('should return 10-50MB for files between 10-50MB', () => {
      const MB = 1024 * 1024;
      expect(getFileSizeBucket(10 * MB)).toBe('10-50MB');
      expect(getFileSizeBucket(25 * MB)).toBe('10-50MB');
    });

    it('should return 50-100MB for files between 50-100MB', () => {
      const MB = 1024 * 1024;
      expect(getFileSizeBucket(50 * MB)).toBe('50-100MB');
      expect(getFileSizeBucket(75 * MB)).toBe('50-100MB');
    });

    it('should return >100MB for files over 100MB', () => {
      const MB = 1024 * 1024;
      expect(getFileSizeBucket(100 * MB)).toBe('>100MB');
      expect(getFileSizeBucket(500 * MB)).toBe('>100MB');
    });
  });

  describe('getFileTypeCategory', () => {
    it('should return correct category for common mime types', () => {
      expect(getFileTypeCategory('image/jpeg')).toBe('image');
      expect(getFileTypeCategory('video/mp4')).toBe('video');
      expect(getFileTypeCategory('audio/mpeg')).toBe('audio');
      expect(getFileTypeCategory('text/plain')).toBe('text');
      expect(getFileTypeCategory('application/pdf')).toBe('application');
    });

    it('should return "other" for unknown mime types', () => {
      expect(getFileTypeCategory('custom/unknown')).toBe('other');
      expect(getFileTypeCategory('weird-format')).toBe('other');
    });

    it('should return "unknown" for empty mime type', () => {
      expect(getFileTypeCategory('')).toBe('unknown');
    });

    it('should handle mime types without subtype', () => {
      expect(getFileTypeCategory('image')).toBe('image');
      expect(getFileTypeCategory('video')).toBe('video');
    });
  });
});
