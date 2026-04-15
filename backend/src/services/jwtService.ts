/**
 * JWT Service
 * Handles JWT token generation and verification for user sessions
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d'; // Long-lived refresh token

interface JWTPayload {
  email: string;
  emailHash: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(email: string): string {
  try {
    // Hash email for privacy (include in JWT payload)
    const emailHash = hashEmail(email);

    const payload: JWTPayload = {
      email, // Include plaintext for backend use only
      emailHash, // Hashed version for privacy
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    } as any);

    logger.info('[JWT] Token generated', { emailHash });
    return token;
  } catch (error) {
    logger.error('[JWT] Failed to generate token', error as Error);
    throw new Error('Token generation failed');
  }
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('[JWT] Token expired');
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('[JWT] Invalid token');
      throw new Error('Invalid token');
    }
    logger.error('[JWT] Token verification failed', error as Error);
    throw new Error('Token verification failed');
  }
}

/**
 * Hash email using SHA-256 (consistent with email hashing elsewhere)
 */
function hashEmail(email: string): string {
  const salt = process.env.EMAIL_HASH_SALT || 'default-salt';
  return crypto
    .createHash('sha256')
    .update(email + salt)
    .digest('hex');
}

/**
 * Generate a refresh token for a user
 */
export function generateRefreshToken(email: string): string {
  try {
    const emailHash = hashEmail(email);

    const payload: JWTPayload = {
      email,
      emailHash,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    } as any);

    logger.info('[JWT] Refresh token generated', { emailHash });
    return token;
  } catch (error) {
    logger.error('[JWT] Failed to generate refresh token', error as Error);
    throw new Error('Refresh token generation failed');
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('[JWT] Refresh token expired');
      throw new Error('Refresh token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('[JWT] Invalid refresh token');
      throw new Error('Invalid refresh token');
    }
    logger.error('[JWT] Refresh token verification failed', error as Error);
    throw new Error('Refresh token verification failed');
  }
}

