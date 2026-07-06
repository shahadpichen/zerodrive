import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../config/database";
import { MINIO_BUCKET, s3Client } from "../config/s3";
import logger from "../utils/logger";

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  minioDeletedCount: number;
  storageFreedBytes: number;
  error?: string;
}

export const cleanupExpiredShares = async (): Promise<CleanupResult> => {
  try {
    const candidates = await query<{
      id: string;
      file_id: string;
      file_size: number | string | null;
    }>(
      `SELECT id, file_id, file_size
       FROM shared_files
       WHERE status = 'deleting'
          OR (status = 'pending' AND pending_expires_at < CURRENT_TIMESTAMP)
          OR (
            status = 'active'
            AND expires_at IS NOT NULL
            AND expires_at < CURRENT_TIMESTAMP
          )`,
      [],
    );

    let deletedCount = 0;
    let minioDeletedCount = 0;
    let storageFreedBytes = 0;

    for (const share of candidates.rows) {
      await query(
        `UPDATE shared_files
         SET status = 'deleting', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [share.id],
      );

      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: share.file_id,
          }),
        );
        minioDeletedCount += 1;
        storageFreedBytes += Number(share.file_size || 0);
        const deleted = await query(
          "DELETE FROM shared_files WHERE id = $1 AND status = 'deleting'",
          [share.id],
        );
        deletedCount += deleted.rowCount;
      } catch {
        await query(
          `UPDATE shared_files
           SET deletion_attempts = deletion_attempts + 1,
               deletion_last_error = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [share.id, "OBJECT_DELETE_FAILED"],
        );
        logger.warn("Share storage deletion will be retried", {
          shareId: share.id,
        });
      }
    }

    return {
      success: true,
      deletedCount,
      minioDeletedCount,
      storageFreedBytes,
    };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      minioDeletedCount: 0,
      storageFreedBytes: 0,
      error: error instanceof Error ? error.message : "Cleanup failed",
    };
  }
};

if (require.main === module) {
  cleanupExpiredShares().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}
