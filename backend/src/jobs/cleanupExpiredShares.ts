/**
 * Cleanup Job for Expired Shared Files
 * Deletes shared files that have passed their expiration date
 */

import { query } from '../config/database';
import logger from '../utils/logger';

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

/**
 * Delete expired shared files from the database
 */
export const cleanupExpiredShares = async (): Promise<CleanupResult> => {
  const startTime = Date.now();

  try {
    logger.info('Starting expired shared files cleanup...');

    // Delete all shared files where expires_at has passed
    const result = await query(
      `DELETE FROM shared_files
       WHERE expires_at IS NOT NULL
       AND expires_at < CURRENT_TIMESTAMP
       RETURNING id, file_name, expires_at`,
      []
    );

    const deletedCount = result.rowCount;
    const duration = Date.now() - startTime;

    if (deletedCount > 0) {
      logger.info(`Cleanup completed: ${deletedCount} expired file(s) deleted in ${duration}ms`);

      // Log details of deleted files for audit purposes
      result.rows.forEach((file: any) => {
        logger.debug('Deleted expired file', {
          id: file.id,
          fileName: file.file_name,
          expiredAt: file.expires_at
        });
      });
    } else {
      logger.info(`Cleanup completed: No expired files found (${duration}ms)`);
    }

    return {
      success: true,
      deletedCount
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as Error;

    logger.error('Cleanup job failed', {
      error: err.message,
      duration
    });

    return {
      success: false,
      deletedCount: 0,
      error: err.message
    };
  }
};

// Allow running this file directly for manual cleanup
if (require.main === module) {
  cleanupExpiredShares()
    .then((result) => {
      if (result.success) {
        console.log(`✅ Cleanup successful: ${result.deletedCount} file(s) deleted`);
        process.exit(0);
      } else {
        console.error(`❌ Cleanup failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}
