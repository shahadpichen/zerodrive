/**
 * Analytics Tracker for Frontend
 *
 * Tracks user events by sending them to the backend analytics API.
 * Privacy-first: No user-identifying information is sent.
 */

import apiClient from './apiClient';
import logger from './logger';

// Event types (matching backend)
export enum AnalyticsEvent {
  // Authentication
  USER_LOGIN = 'user_login',
  USER_LOGIN_NEW = 'user_login_new',
  USER_LOGIN_EXISTING = 'user_login_existing',
  USER_LOGIN_LIMITED_SCOPE = 'user_login_limited_scope',

  // Files
  FILE_ADDED_TO_DRIVE = 'file_added_to_drive',

  // Sharing
  FILE_SHARED = 'file_shared',
  INVITATION_SENT = 'invitation_sent',
  SHARED_FILE_ACCESSED = 'shared_file_accessed',
}

// Event categories
export enum AnalyticsCategory {
  AUTH = 'auth',
  FILES = 'files',
  SHARING = 'sharing',
}

/**
 * Track an analytics event
 *
 * @param event - Event type to track
 * @param category - Event category (defaults based on event type)
 * @param metadata - Optional anonymous metadata (NO user identifiers!)
 */
export async function trackEvent(
  event: AnalyticsEvent,
  category?: AnalyticsCategory,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Determine category if not provided
    const eventCategory = category || getCategoryForEvent(event);

    // Send to backend
    await apiClient.post('/analytics/track', {
      event,
      category: eventCategory,
      metadata: metadata || {},
    });

    logger.log('[Analytics] Event tracked:', event);
  } catch (error) {
    // Don't let analytics failures break the app
    logger.error('[Analytics] Failed to track event:', error);
  }
}

/**
 * Get the default category for an event type
 */
function getCategoryForEvent(event: AnalyticsEvent): AnalyticsCategory {
  if (event.includes('login') || event.includes('logout')) {
    return AnalyticsCategory.AUTH;
  }
  if (event.includes('file') || event.includes('upload') || event.includes('download')) {
    return AnalyticsCategory.FILES;
  }
  if (event.includes('share') || event.includes('invitation')) {
    return AnalyticsCategory.SHARING;
  }
  if (event.includes('key')) {
    return AnalyticsCategory.KEYS;
  }
  if (event.includes('error') || event.includes('failed')) {
    return AnalyticsCategory.ERRORS;
  }
  return AnalyticsCategory.AUTH; // default
}

/**
 * Track user login event
 *
 * @param isNewUser - Whether this is a first-time user
 * @param hasLimitedScope - Whether user logged in without full Google Drive scope
 */
export async function trackLogin(
  isNewUser: boolean,
  hasLimitedScope: boolean
): Promise<void> {
  if (hasLimitedScope) {
    await trackEvent(AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE);
  } else if (isNewUser) {
    await trackEvent(AnalyticsEvent.USER_LOGIN_NEW);
  } else {
    await trackEvent(AnalyticsEvent.USER_LOGIN_EXISTING);
  }
}

/**
 * Track file added to Google Drive
 * (called for both uploads and downloads/retrieves)
 *
 * @param source - Whether file was 'uploaded' or 'downloaded'
 */
export async function trackFileAddedToDrive(
  source: 'upload' | 'download'
): Promise<void> {
  await trackEvent(
    AnalyticsEvent.FILE_ADDED_TO_DRIVE,
    AnalyticsCategory.FILES,
    { source }
  );
}

export default {
  trackEvent,
  trackLogin,
  trackFileAddedToDrive,
};
