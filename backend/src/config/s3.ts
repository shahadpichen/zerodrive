/**
 * MinIO S3 Client Configuration
 */

import { S3Client } from '@aws-sdk/client-s3';
import logger from '../utils/logger';

// MinIO configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = process.env.MINIO_PORT || '9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'zerodrive-files';

// Construct endpoint URL (don't add port if it's the default for the protocol)
const isDefaultPort = (MINIO_USE_SSL && MINIO_PORT === '443') || (!MINIO_USE_SSL && MINIO_PORT === '80');
const portPart = isDefaultPort ? '' : `:${MINIO_PORT}`;
const endpoint = `${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}${portPart}`;

/**
 * S3 client configured for MinIO
 */
export const s3Client = new S3Client({
  region: 'us-east-1', // MinIO doesn't use regions, but SDK requires it
  endpoint: endpoint,
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

logger.info('MinIO S3 client configured', {
  endpoint,
  bucket: MINIO_BUCKET,
  useSSL: MINIO_USE_SSL
});

export default s3Client;
