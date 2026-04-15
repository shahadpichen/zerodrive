/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user info to requests
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwtService';
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
    // Extract token from cookie (httpOnly)
    const token = req.cookies.zerodrive_token;

    if (!token) {
      throw ApiErrors.Unauthorized('No authentication token provided');
    }

    // CSRF validation for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const csrfTokenFromHeader = req.headers['x-csrf-token'];
      const csrfTokenFromCookie = req.cookies.zerodrive_csrf;

      if (!csrfTokenFromHeader || !csrfTokenFromCookie) {
        logger.warn('[Auth] CSRF token missing', { method: req.method, path: req.path });
        throw ApiErrors.Forbidden('CSRF token required');
      }

      if (csrfTokenFromHeader !== csrfTokenFromCookie) {
        logger.warn('[Auth] CSRF token mismatch', { method: req.method, path: req.path });
        throw ApiErrors.Forbidden('CSRF validation failed');
      }
    }

    // Verify JWT token
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
    } else if (error instanceof Error && error.message.includes('CSRF')) {
      next(error); // Pass CSRF errors directly
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
    // Extract token from cookie
    const token = req.cookies.zerodrive_token;

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
