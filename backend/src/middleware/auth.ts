/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user info to requests
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../services/jwtService';
import logger from '../utils/logger';
import { ApiErrors } from './errorHandler';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        emailHash: string;
      };
    }
  }
}

/**
 * Middleware to require authentication on routes
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw ApiErrors.Unauthorized('No authentication token provided');
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    req.user = {
      email: payload.email,
      emailHash: payload.emailHash,
    };

    logger.debug('[Auth] Request authenticated', { emailHash: payload.emailHash });
    next();
  } catch (error) {
    logger.warn('[Auth] Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });

    if (error instanceof Error && error.message.includes('expired')) {
      next(ApiErrors.Unauthorized('Token expired'));
    } else if (error instanceof Error && error.message.includes('Invalid')) {
      next(ApiErrors.Unauthorized('Invalid token'));
    } else {
      next(ApiErrors.Unauthorized('Authentication failed'));
    }
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't fail if missing
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const payload = verifyToken(token);
      req.user = {
        email: payload.email,
        emailHash: payload.emailHash,
      };
      logger.debug('[Auth] Optional auth: User authenticated', {
        emailHash: payload.emailHash,
      });
    } else {
      logger.debug('[Auth] Optional auth: No token provided');
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just log
    logger.debug('[Auth] Optional auth: Token validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}
