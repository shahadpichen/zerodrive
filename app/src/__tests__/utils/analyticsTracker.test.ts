/**
 * Unit Tests for Analytics Tracker
 * Tests event tracking, category detection, and error handling
 */

import analyticsTracker, {
  trackEvent,
  trackLogin,
  trackFileAddedToDrive,
  AnalyticsEvent,
  AnalyticsCategory,
} from '../../utils/analyticsTracker';

// Mock dependencies
jest.mock('../../utils/apiClient');
jest.mock('../../utils/logger');

const mockPost = jest.fn();

jest.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
  },
}));

describe('AnalyticsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ success: true, data: {} });
  });

  describe('trackEvent', () => {
    it('should track event successfully with explicit category', async () => {
      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        { source: 'upload' }
      );

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        category: AnalyticsCategory.FILES,
        metadata: { source: 'upload' },
      });
    });

    it('should track event successfully without metadata', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH);

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.USER_LOGIN,
        category: AnalyticsCategory.AUTH,
        metadata: {},
      });
    });

    it('should auto-detect category for login events', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN_NEW);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.AUTH,
        })
      );
    });

    it('should auto-detect category for file events', async () => {
      await trackEvent(AnalyticsEvent.FILE_ADDED_TO_DRIVE);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.FILES,
        })
      );
    });

    it('should auto-detect category for sharing events', async () => {
      await trackEvent(AnalyticsEvent.FILE_SHARED);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.SHARING,
        })
      );
    });

    it('should auto-detect category for invitation events', async () => {
      await trackEvent(AnalyticsEvent.INVITATION_SENT);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.SHARING,
        })
      );
    });

    it('should not throw error when API call fails', async () => {
      mockPost.mockRejectedValue(new Error('API error'));

      await expect(
        trackEvent(AnalyticsEvent.USER_LOGIN)
      ).resolves.not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await trackEvent(AnalyticsEvent.FILE_ADDED_TO_DRIVE);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should track event with complex metadata', async () => {
      const metadata = {
        source: 'upload',
        fileType: 'image',
        size: 1024000,
        encrypted: true,
      };

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        metadata
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should track event with empty metadata object', async () => {
      await trackEvent(
        AnalyticsEvent.USER_LOGIN,
        AnalyticsCategory.AUTH,
        {}
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          metadata: {},
        })
      );
    });

    it('should handle undefined metadata', async () => {
      await trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          metadata: {},
        })
      );
    });

    it('should use default category for unknown event types', async () => {
      const unknownEvent = 'unknown_event' as AnalyticsEvent;

      await trackEvent(unknownEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.AUTH, // Default category
        })
      );
    });
  });

  describe('trackLogin', () => {
    it('should track new user login', async () => {
      await trackLogin(true, false);

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.USER_LOGIN_NEW,
        category: AnalyticsCategory.AUTH,
        metadata: {},
      });
    });

    it('should track existing user login', async () => {
      await trackLogin(false, false);

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.USER_LOGIN_EXISTING,
        category: AnalyticsCategory.AUTH,
        metadata: {},
      });
    });

    it('should track limited scope login', async () => {
      await trackLogin(false, true);

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE,
        category: AnalyticsCategory.AUTH,
        metadata: {},
      });
    });

    it('should track limited scope for new user', async () => {
      await trackLogin(true, true);

      // Limited scope takes priority
      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE,
        category: AnalyticsCategory.AUTH,
        metadata: {},
      });
    });

    it('should handle API errors gracefully', async () => {
      mockPost.mockRejectedValue(new Error('API error'));

      await expect(trackLogin(true, false)).resolves.not.toThrow();
    });
  });

  describe('trackFileAddedToDrive', () => {
    it('should track file uploaded to drive', async () => {
      await trackFileAddedToDrive('upload');

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        category: AnalyticsCategory.FILES,
        metadata: { source: 'upload' },
      });
    });

    it('should track file downloaded to drive', async () => {
      await trackFileAddedToDrive('download');

      expect(mockPost).toHaveBeenCalledWith('/analytics/track', {
        event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        category: AnalyticsCategory.FILES,
        metadata: { source: 'download' },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockPost.mockRejectedValue(new Error('API error'));

      await expect(
        trackFileAddedToDrive('upload')
      ).resolves.not.toThrow();
    });
  });

  describe('Category Detection', () => {
    it('should detect AUTH category for logout events', async () => {
      const logoutEvent = 'user_logout' as AnalyticsEvent;

      await trackEvent(logoutEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.AUTH,
        })
      );
    });

    it('should detect FILES category for upload events', async () => {
      const uploadEvent = 'file_upload_started' as AnalyticsEvent;

      await trackEvent(uploadEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.FILES,
        })
      );
    });

    it('should detect FILES category for download events', async () => {
      const downloadEvent = 'file_download_completed' as AnalyticsEvent;

      await trackEvent(downloadEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.FILES,
        })
      );
    });

    it('should detect SHARING category for share events', async () => {
      const shareEvent = AnalyticsEvent.FILE_SHARED;

      await trackEvent(shareEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.SHARING,
        })
      );
    });

    it('should detect SHARING category for access events', async () => {
      const accessEvent = AnalyticsEvent.SHARED_FILE_ACCESSED;

      await trackEvent(accessEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.SHARING,
        })
      );
    });

    it('should detect KEYS category for key events', async () => {
      const keyEvent = 'key_generated' as AnalyticsEvent;

      await trackEvent(keyEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.KEYS,
        })
      );
    });

    it('should detect ERRORS category for error events', async () => {
      const errorEvent = 'encryption_error' as AnalyticsEvent;

      await trackEvent(errorEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.ERRORS,
        })
      );
    });

    it('should detect ERRORS category for failed events', async () => {
      const failedEvent = 'upload_failed' as AnalyticsEvent;

      await trackEvent(failedEvent);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.ERRORS,
        })
      );
    });
  });

  describe('Default Export', () => {
    it('should export trackEvent function', () => {
      expect(analyticsTracker.trackEvent).toBe(trackEvent);
    });

    it('should export trackLogin function', () => {
      expect(analyticsTracker.trackLogin).toBe(trackLogin);
    });

    it('should export trackFileAddedToDrive function', () => {
      expect(analyticsTracker.trackFileAddedToDrive).toBe(trackFileAddedToDrive);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent tracking calls', async () => {
      const promises = [
        trackEvent(AnalyticsEvent.USER_LOGIN),
        trackEvent(AnalyticsEvent.FILE_ADDED_TO_DRIVE),
        trackEvent(AnalyticsEvent.FILE_SHARED),
      ];

      await Promise.all(promises);

      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it('should handle metadata with null values', async () => {
      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        { source: null, type: 'test' }
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          metadata: { source: null, type: 'test' },
        })
      );
    });

    it('should handle metadata with nested objects', async () => {
      const metadata = {
        file: {
          id: '123',
          metadata: {
            size: 1024,
            type: 'image',
          },
        },
      };

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        metadata
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({ metadata })
      );
    });

    it('should handle metadata with arrays', async () => {
      const metadata = {
        tags: ['important', 'work', 'encrypted'],
        users: ['user1', 'user2'],
      };

      await trackEvent(
        AnalyticsEvent.FILE_SHARED,
        AnalyticsCategory.SHARING,
        metadata
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({ metadata })
      );
    });

    it('should handle very large metadata objects', async () => {
      const largeMetadata = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
        })),
      };

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        largeMetadata
      );

      expect(mockPost).toHaveBeenCalled();
    });

    it('should handle special characters in metadata', async () => {
      const metadata = {
        name: 'Test @#$% File',
        description: 'Special chars: <>&"\'',
      };

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        metadata
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({ metadata })
      );
    });

    it('should not throw when API returns non-success', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'API error' });

      await expect(
        trackEvent(AnalyticsEvent.USER_LOGIN)
      ).resolves.not.toThrow();
    });

    it('should handle timeout errors', async () => {
      mockPost.mockRejectedValue(new Error('Request timeout'));

      await expect(
        trackEvent(AnalyticsEvent.FILE_ADDED_TO_DRIVE)
      ).resolves.not.toThrow();
    });

    it('should track multiple login types in sequence', async () => {
      await trackLogin(true, false);
      await trackLogin(false, false);
      await trackLogin(false, true);

      expect(mockPost).toHaveBeenCalledTimes(3);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        '/analytics/track',
        expect.objectContaining({
          event: AnalyticsEvent.USER_LOGIN_NEW,
        })
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        '/analytics/track',
        expect.objectContaining({
          event: AnalyticsEvent.USER_LOGIN_EXISTING,
        })
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        '/analytics/track',
        expect.objectContaining({
          event: AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE,
        })
      );
    });

    it('should handle mixed source types for trackFileAddedToDrive', async () => {
      await trackFileAddedToDrive('upload');
      await trackFileAddedToDrive('download');

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        '/analytics/track',
        expect.objectContaining({
          metadata: { source: 'upload' },
        })
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        '/analytics/track',
        expect.objectContaining({
          metadata: { source: 'download' },
        })
      );
    });

    it('should handle events with numbers in names', async () => {
      const event = 'file_version_2_uploaded' as AnalyticsEvent;

      await trackEvent(event);

      expect(mockPost).toHaveBeenCalled();
    });

    it('should handle events with underscores', async () => {
      const event = 'user_profile_updated' as AnalyticsEvent;

      await trackEvent(event);

      expect(mockPost).toHaveBeenCalled();
    });

    it('should override auto-detected category when explicitly provided', async () => {
      // Event contains 'file' which would auto-detect as FILES
      const fileEvent = AnalyticsEvent.FILE_ADDED_TO_DRIVE;

      // But we explicitly set it to ERRORS
      await trackEvent(fileEvent, AnalyticsCategory.ERRORS);

      expect(mockPost).toHaveBeenCalledWith(
        '/analytics/track',
        expect.objectContaining({
          category: AnalyticsCategory.ERRORS,
        })
      );
    });
  });

  describe('Privacy Compliance', () => {
    it('should not include user identifiers in metadata by design', async () => {
      // This test validates the API design - trackEvent accepts metadata
      // but the implementation should never include PII
      const safeMetadata = {
        source: 'upload',
        fileType: 'image',
        encrypted: true,
      };

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        safeMetadata
      );

      const callArgs = mockPost.mock.calls[0][1];
      expect(callArgs.metadata).toEqual(safeMetadata);
      expect(callArgs.metadata).not.toHaveProperty('userId');
      expect(callArgs.metadata).not.toHaveProperty('email');
      expect(callArgs.metadata).not.toHaveProperty('name');
    });
  });
});
