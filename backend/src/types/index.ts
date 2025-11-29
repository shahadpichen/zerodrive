/**
 * TypeScript Type Definitions for ZeroDrive Backend
 */

// Database Models
export interface PublicKey {
  id?: string;
  user_id: string;
  public_key: string;
  credits?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface SharedFile {
  id?: string;
  file_id: string;
  recipient_user_id: string;
  encrypted_file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  access_type: 'view' | 'download';
  expires_at?: Date;
  last_accessed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreditTransaction {
  id?: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  balance_after: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export interface CreditPackage {
  id: string;
  credits: number;
  price_usd: number;
  price_per_credit: number;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// API Request/Response Types
export interface CreatePublicKeyRequest {
  user_id: string;
  public_key: string;
}

export interface GetPublicKeyRequest {
  user_id?: string;
}

export interface CreateSharedFileRequest {
  file_id: string;
  recipient_user_id: string;
  encrypted_file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  access_type?: 'view' | 'download';
  expires_at?: string; // ISO date string
}

export interface UpdateSharedFileRequest {
  access_type?: 'view' | 'download';
  expires_at?: Date | null;
}

export interface GetSharedFileRequest {
  id?: string;
}

export interface GetSharedFilesQuery {
  recipient_user_id?: string;
  limit?: number;
  offset?: number;
}

export interface GetCreditBalanceRequest {
  user_id: string;
}

export interface CreditBalanceResponse {
  user_id: string;
  balance: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  message?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Database Query Results
export interface UserPublicKeyRow {
  id: string;
  hashed_email_identifier: string;
  public_key_jwk: any; // JSON from PostgreSQL
  created_at: string;
  updated_at: string;
}

export interface SharedFileRow {
  id: string;
  share_id: string;
  encrypted_file_blob_id: string;
  recipient_email_hash: string;
  encrypted_file_key: Buffer | string; // Can be Buffer or hex string
  sender_proof: string;
  file_name: string;
  file_mime_type: string;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_claimed: boolean;
}

// Service Layer Types
export interface CreatePublicKeyData {
  hashedEmail: string;
  publicKeyJwk: string;
}

export interface CreateSharedFileData {
  shareId: string;
  encryptedFileBlobId: string;
  recipientEmailHash: string;
  encryptedFileKey: string;
  senderProof: string;
  fileName: string;
  fileMimeType: string;
  fileSize?: number;
  expiresAt?: Date;
}

export interface GetSharedFilesOptions {
  recipientEmailHash: string;
  page?: number;
  limit?: number;
  claimed?: boolean;
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: 'connected' | 'disconnected';
}

// Error Types
export interface ApiErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
}

// Environment Variables
export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_MAX_CONNECTIONS: number;
  DB_IDLE_TIMEOUT: number;
  DB_CONNECTION_TIMEOUT: number;
  FRONTEND_URL: string;
  ALLOWED_ORIGINS: string;
  JWT_SECRET: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  MINIO_ENDPOINT: string;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
  MINIO_REGION: string;
  LOG_LEVEL: string;
  LOG_FORMAT: string;
  ENABLE_CLEANUP_JOB: boolean;
  CLEANUP_INTERVAL_HOURS: number;
}

// Utility Types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMeta {
  [key: string]: any;
}

export interface RequestLogMeta extends LogMeta {
  method: string;
  url: string;
  status: number;
  duration: string;
  userAgent?: string;
  ip: string;
}

// Database Connection Types
export interface DatabaseConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: any[];
}

// Express Request Extensions
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      requestId?: string;
    }
  }
}

// Export commonly used types
export type CreatePublicKeyResult = Pick<PublicKey, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type CreateSharedFileResult = Pick<SharedFile, 'id' | 'file_id' | 'file_name' | 'created_at'>;
export type ClaimSharedFileResult = Pick<SharedFile, 'id' | 'file_id' | 'file_name' | 'updated_at'>;
export type DeleteSharedFileResult = Pick<SharedFile, 'id' | 'file_id' | 'file_name'>;

// Validation Schemas (for Joi)
export interface ValidationSchemas {
  publicKey: any;
  hashedEmail: any;
  sharedFile: any;
  recipientQuery: any;
  shareId: any;
  fileId: any;
}