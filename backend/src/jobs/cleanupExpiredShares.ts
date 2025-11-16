/**
 * Cleanup Job for Expired Shared Files
 * Deletes shared files that have passed their expiration date
 * Removes both database records AND encrypted files from MinIO storage
 */

import { query } from '../config/database';
import logger from '../utils/logger';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, MINIO_BUCKET } from '../config/s3';

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  minioDeletedCount: number;
  storageFreedBytes: number;
  error?: string;
}

/**
 * Delete expired shared files from the database
 */
export const cleanupExpiredShares = async (): Promise<CleanupResult> => {
  const startTime = Date.now();

  try {
    logger.info('Starting expired shared files cleanup...');

    // Step 1: Query expired files (including file_id for MinIO deletion)
    const expiredFiles = await query(
      `SELECT id, file_id, file_name, file_size, expires_at
       FROM shared_files
       WHERE expires_at IS NOT NULL
       AND expires_at < CURRENT_TIMESTAMP`,
      []
    );

    const fileCount = expiredFiles.rowCount;

    if (fileCount === 0) {
      const duration = Date.now() - startTime;
      logger.info(`Cleanup completed: No expired files found (${duration}ms)`);
      return {
        success: true,
        deletedCount: 0,
        minioDeletedCount: 0,
        storageFreedBytes: 0
      };
    }

    // Step 2: Delete files from MinIO storage
    let minioDeletedCount = 0;
    let storageFreedBytes = 0;

    for (const file of expiredFiles.rows) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: file.file_id
        });

        await s3Client.send(deleteCommand);
        minioDeletedCount++;
        storageFreedBytes += file.file_size || 0;

        logger.debug('Deleted file from MinIO', {
          fileId: file.file_id,
          fileName: file.file_name,
          size: file.file_size
        });
      } catch (minioError) {
        // Log warning but continue - orphaned files are acceptable
        logger.warn('Failed to delete file from MinIO (continuing with DB cleanup)', {
          fileId: file.file_id,
          fileName: file.file_name,
          error: minioError instanceof Error ? minioError.message : 'Unknown error'
        });
      }
    }

    // Step 3: Delete database records
    const deleteResult = await query(
      `DELETE FROM shared_files
       WHERE expires_at IS NOT NULL
       AND expires_at < CURRENT_TIMESTAMP
       RETURNING id, file_name, expires_at`,
      []
    );

    const deletedCount = deleteResult.rowCount;
    const duration = Date.now() - startTime;

    // Format storage size for logging
    const storageMB = (storageFreedBytes / (1024 * 1024)).toFixed(2);

    logger.info(`Cleanup completed: ${deletedCount} DB record(s) deleted, ${minioDeletedCount} file(s) removed from storage, ${storageMB} MB freed (${duration}ms)`);

    // Log details of deleted files for audit purposes
    deleteResult.rows.forEach((file: any) => {
      logger.debug('Deleted expired file', {
        id: file.id,
        fileName: file.file_name,
        expiredAt: file.expires_at
      });
    });

    return {
      success: true,
      deletedCount,
      minioDeletedCount,
      storageFreedBytes
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
      minioDeletedCount: 0,
      storageFreedBytes: 0,
      error: err.message
    };
  }
};

// Allow running this file directly for manual cleanup
if (require.main === module) {
  cleanupExpiredShares()
    .then((result) => {
      if (result.success) {
        const storageMB = (result.storageFreedBytes / (1024 * 1024)).toFixed(2);
        console.log(`✅ Cleanup successful:`);
        console.log(`   - Database records deleted: ${result.deletedCount}`);
        console.log(`   - MinIO files deleted: ${result.minioDeletedCount}`);
        console.log(`   - Storage freed: ${storageMB} MB`);
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
