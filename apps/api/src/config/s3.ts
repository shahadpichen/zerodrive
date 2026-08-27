/**
 * MinIO S3 Client Configuration
 */

import { S3Client } from "@aws-sdk/client-s3";
import logger from "../utils/logger";
import {
  validateS3Config,
  validateS3PublicEndpoint,
} from "./runtimeValidation";

validateS3Config(
  process.env.NODE_ENV || "development",
  process.env.MINIO_ACCESS_KEY,
  process.env.MINIO_SECRET_KEY,
);
validateS3PublicEndpoint(
  process.env.NODE_ENV || "development",
  process.env.MINIO_PUBLIC_ENDPOINT,
);

// MinIO configuration from environment
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = process.env.MINIO_PORT || "9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "minioadmin123";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
export const MINIO_BUCKET = process.env.MINIO_BUCKET || "zerodrive-files";

// Construct endpoint URL (don't add port if it's the default for the protocol)
const isDefaultPort =
  (MINIO_USE_SSL && MINIO_PORT === "443") ||
  (!MINIO_USE_SSL && MINIO_PORT === "80");
const portPart = isDefaultPort ? "" : `:${MINIO_PORT}`;
const endpoint = `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}${portPart}`;
const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT?.trim() || endpoint;

function createS3Client(targetEndpoint: string): S3Client {
  return new S3Client({
    region: "us-east-1", // MinIO doesn't use regions, but SDK requires it
    endpoint: targetEndpoint,
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

/**
 * S3 client configured for MinIO
 */
export const s3Client = createS3Client(endpoint);

/**
 * Signing-only client. The API uses the private endpoint for server-side
 * object operations, while browsers receive URLs for the public TLS origin.
 */
export const s3PresignClient = createS3Client(publicEndpoint);

logger.info("MinIO S3 client configured", {
  endpoint,
  publicEndpoint,
  bucket: MINIO_BUCKET,
  useSSL: MINIO_USE_SSL,
});

export default s3Client;
