/**
 * Anonymous Analytics Service
 *
 * Privacy-first analytics that tracks COUNTS, not USERS.
 *
 * IMPORTANT: Never store user-identifying information:
 * - No emails
 * - No IP addresses
 * - No session IDs
 * - No user IDs
 *
 * Only track anonymous events and aggregated metrics.
 */

import { query } from '../config/database';
import logger from '../utils/logger';

// Event types
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
 * Track an anonymous event by incrementing daily counters
 *
 * @param eventType - Type of event (from AnalyticsEvent enum)
 * @param category - Event category
 * @param metadata - Optional anonymous context (NO user identifiers!)
 */
export async function trackEvent(
  eventType: AnalyticsEvent | string,
  category: AnalyticsCategory,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Validate metadata doesn't contain user identifiers
    if (metadata) {
      validateAnonymousMetadata(metadata);
    }

    // Map event type to counter column
    const columnMap: Record<string, string> = {
      [AnalyticsEvent.USER_LOGIN]: 'total_logins',
      [AnalyticsEvent.USER_LOGIN_NEW]: 'total_new_users',
      [AnalyticsEvent.USER_LOGIN_EXISTING]: 'total_logins',
      [AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE]: 'total_limited_scope_logins',
      [AnalyticsEvent.FILE_ADDED_TO_DRIVE]: 'total_files_added_to_drive',
      [AnalyticsEvent.FILE_SHARED]: 'total_shares',
      [AnalyticsEvent.INVITATION_SENT]: 'total_invitations',
      [AnalyticsEvent.SHARED_FILE_ACCESSED]: 'total_downloads',
    };

    // Determine which column to increment
    const column = columnMap[eventType] || null;

    if (!column) {
      logger.warn('[Analytics] Unknown event type, not tracking', { eventType });
      return;
    }

    // Increment daily counter using upsert
    await query(`
      INSERT INTO analytics_daily_summary (date, ${column})
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (date)
      DO UPDATE SET ${column} = analytics_daily_summary.${column} + 1
    `);

    logger.info('[Analytics] Event tracked', {
      event: eventType,
      category,
      column
    });
  } catch (error) {
    // Don't let analytics failures break the app
    logger.error('[Analytics] Failed to track event', {
      event: eventType,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Validate that metadata doesn't contain user-identifying information
 */
function validateAnonymousMetadata(metadata: Record<string, any>): void {
  const forbiddenKeys = [
    'email', 'user_id', 'userId', 'user', 'username',
    'ip', 'ipAddress', 'ip_address',
    'session', 'sessionId', 'session_id',
    'name', 'phone', 'address'
  ];

  const metadataKeys = Object.keys(metadata).map(k => k.toLowerCase());
  const violations = forbiddenKeys.filter(key =>
    metadataKeys.includes(key.toLowerCase())
  );

  if (violations.length > 0) {
    logger.warn('[Analytics] Metadata contains forbidden keys', {
      violations,
      metadata: Object.keys(metadata)
    });

    // Remove forbidden keys
    violations.forEach(key => {
      const actualKey = Object.keys(metadata).find(k =>
        k.toLowerCase() === key.toLowerCase()
      );
      if (actualKey) {
        delete metadata[actualKey];
      }
    });
  }
}

/**
 * Helper to get file size bucket (for privacy)
 * Instead of exact size, use ranges
 */
export function getFileSizeBucket(sizeBytes: number): string {
  const MB = 1024 * 1024;

  if (sizeBytes < MB) return '<1MB';
  if (sizeBytes < 10 * MB) return '1-10MB';
  if (sizeBytes < 50 * MB) return '10-50MB';
  if (sizeBytes < 100 * MB) return '50-100MB';
  return '>100MB';
}

/**
 * Helper to get file type category (not exact extension)
 */
export function getFileTypeCategory(mimeType: string): string {
  if (!mimeType) return 'unknown';

  const type = mimeType.split('/')[0];
  const validTypes = ['image', 'video', 'audio', 'text', 'application'];

  return validTypes.includes(type) ? type : 'other';
}

/**
 * Get analytics summary for a date range
 */
export async function getAnalyticsSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
}> {
  try {
    // Get sum of all counters for the date range
    const result = await query(`
      SELECT
        SUM(total_logins) as logins,
        SUM(total_new_users) as new_users,
        SUM(total_limited_scope_logins) as limited_scope_logins,
        SUM(total_downloads) as downloads,
        SUM(total_files_added_to_drive) as files_added_to_drive,
        SUM(total_shares) as shares,
        SUM(total_invitations) as invitations
      FROM analytics_daily_summary
      WHERE date BETWEEN $1 AND $2
    `, [startDate, endDate]);

    const row = result.rows[0];

    const logins = parseInt(row.logins) || 0;
    const newUsers = parseInt(row.new_users) || 0;
    const limitedScopeLogins = parseInt(row.limited_scope_logins) || 0;
    const downloads = parseInt(row.downloads) || 0;
    const filesAddedToDrive = parseInt(row.files_added_to_drive) || 0;
    const shares = parseInt(row.shares) || 0;
    const invitations = parseInt(row.invitations) || 0;

    // Build response matching expected format
    const eventsByType: Record<string, number> = {
      'user_login': logins,
      'user_login_new': newUsers,
      'user_login_limited_scope': limitedScopeLogins,
      'shared_file_accessed': downloads,
      'file_added_to_drive': filesAddedToDrive,
      'file_shared': shares,
      'invitation_sent': invitations,
    };

    const eventsByCategory: Record<string, number> = {
      'auth': logins + newUsers + limitedScopeLogins,
      'files': downloads + filesAddedToDrive,
      'sharing': shares + invitations,
    };

    const totalEvents = logins + newUsers + limitedScopeLogins + downloads + filesAddedToDrive + shares + invitations;

    return {
      totalEvents,
      eventsByType,
      eventsByCategory,
    };
  } catch (error) {
    logger.error('[Analytics] Failed to get summary', error as Error);
    throw error;
  }
}

/**
 * Get daily stats for charting
 */
export async function getDailyStats(days: number = 30): Promise<Array<{
  date: string;
  logins: number;
  filesAdded: number;
  shares: number;
  downloads: number;
}>> {
  try {
    const result = await query(`
      SELECT
        date,
        total_logins as logins,
        total_files_added_to_drive as files_added,
        total_shares as shares,
        total_downloads as downloads
      FROM analytics_daily_summary
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `);

    return result.rows.map(row => ({
      date: row.date,
      logins: parseInt(row.logins) || 0,
      filesAdded: parseInt(row.files_added) || 0,
      shares: parseInt(row.shares) || 0,
      downloads: parseInt(row.downloads) || 0,
    }));
  } catch (error) {
    logger.error('[Analytics] Failed to get daily stats', error as Error);
    throw error;
  }
}
