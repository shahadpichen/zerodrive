/**
 * Authentication Routes
 * Handles Google OAuth flow and session management
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getAuthUrl, getTokensFromCode, getUserInfo, hasFullDriveScope } from '../services/googleOAuthService';
import { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } from '../services/jwtService';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiErrors } from '../middleware/errorHandler';
import { trackEvent, AnalyticsEvent, AnalyticsCategory } from '../services/analytics';
import { query } from '../config/database';
import logger from '../utils/logger';

const router = Router();

const FRONTEND_URL = process.env.APP_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', asyncHandler(async (req: Request, res: Response) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('[Auth] Failed to generate OAuth URL', error as Error);
    res.redirect(`${FRONTEND_URL}?error=oauth_init_failed`);
  }
}));

/**
 * GET /api/auth/callback/google
 * Handle Google OAuth callback
 */
router.get('/callback/google', asyncHandler(async (req: Request, res: Response) => {
  const { code, error } = req.query;

  // Handle OAuth errors
  if (error) {
    logger.warn('[Auth] OAuth callback error', { error });
    return res.redirect(`${FRONTEND_URL}?error=${error}`);
  }

  if (!code || typeof code !== 'string') {
    logger.warn('[Auth] No authorization code in callback');
    return res.redirect(`${FRONTEND_URL}?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const { accessToken, refreshToken, scope } = await getTokensFromCode(code);

    // Get user info from Google
    const userInfo = await getUserInfo(accessToken);

    if (!userInfo.verified) {
      logger.warn('[Auth] Unverified email attempted login', { email: userInfo.email });
      return res.redirect(`${FRONTEND_URL}?error=email_not_verified`);
    }

    // Check if user is new (no public key in database)
    const publicKeyResult = await query(
      'SELECT user_id FROM public_keys WHERE user_id = $1',
      [userInfo.email]
    );
    const isNewUser = publicKeyResult.rows.length === 0;

    // Check if user granted full Drive scope
    const hasLimitedScope = !hasFullDriveScope(scope);

    // Store Google tokens in database (upsert)
    const tokenExpiry = new Date(Date.now() + 3600 * 1000); // Access tokens typically expire in 1 hour
    await query(
      `INSERT INTO user_google_tokens (user_id, access_token, refresh_token, token_expiry, scope)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, user_google_tokens.refresh_token),
         token_expiry = EXCLUDED.token_expiry,
         scope = EXCLUDED.scope,
         updated_at = CURRENT_TIMESTAMP`,
      [userInfo.email, accessToken, refreshToken || null, tokenExpiry, scope]
    );

    logger.info('[Auth] Stored Google tokens for user', {
      email: userInfo.email,
      hasRefreshToken: !!refreshToken,
    });

    // Track login analytics
    try {
      if (hasLimitedScope) {
        await trackEvent(AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE, AnalyticsCategory.AUTH);
      } else if (isNewUser) {
        await trackEvent(AnalyticsEvent.USER_LOGIN_NEW, AnalyticsCategory.AUTH);
      } else {
        await trackEvent(AnalyticsEvent.USER_LOGIN_EXISTING, AnalyticsCategory.AUTH);
      }
    } catch (analyticsError) {
      logger.error('[Auth] Failed to track login analytics', analyticsError as Error);
      // Don't fail login if analytics fails
    }

    // Generate JWT access token (15 minutes)
    const jwtToken = generateToken(userInfo.email);

    // Generate JWT refresh token (7 days)
    const jwtRefreshToken = generateRefreshToken(userInfo.email);

    // Generate CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');

    logger.info('[Auth] User authenticated successfully', {
      email: userInfo.email,
      isNewUser,
      hasLimitedScope,
    });

    // Set access token cookie (httpOnly, 15 minutes)
    res.cookie('zerodrive_token', jwtToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
      path: '/',
    });

    // Set JWT refresh token cookie (httpOnly, 7 days)
    res.cookie('zerodrive_refresh', jwtRefreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/',
    });

    // Set CSRF token cookie (readable by frontend)
    res.cookie('zerodrive_csrf', csrfToken, {
      httpOnly: false, // Frontend needs to read this
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // Same as refresh token
      path: '/',
    });

    // Redirect to frontend WITHOUT token in URL (more secure)
    res.redirect(`${FRONTEND_URL}/oauth/callback`);
  } catch (error) {
    logger.error('[Auth] OAuth callback failed', error as Error);
    res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
}));

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  logger.info('[Auth /me] Request received', {
    hasCookie: !!req.cookies.zerodrive_token,
    hasUser: !!req.user,
    path: req.path,
  });

  if (!req.user) {
    throw ApiErrors.Unauthorized('Not authenticated');
  }

  res.apiSuccess({
    email: req.user.email,
    emailHash: req.user.emailHash,
  }, 'User info retrieved');
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.zerodrive_refresh;

  if (!refreshToken) {
    throw ApiErrors.Unauthorized('No refresh token provided');
  }

  try {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Generate new access token
    const newAccessToken = generateToken(payload.email);

    // Set new access token cookie
    res.cookie('zerodrive_token', newAccessToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    logger.info('[Auth] Access token refreshed', {
      emailHash: payload.emailHash,
    });

    res.apiSuccess({}, 'Token refreshed successfully');
  } catch (error) {
    logger.warn('[Auth] Token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw ApiErrors.Unauthorized('Invalid or expired refresh token');
  }
}));

/**
 * POST /api/auth/logout
 * Logout user (clear all auth cookies)
 * No auth required - allows logout even with expired token
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  logger.info('[Auth] User logged out');

  // Clear all auth cookies with matching options (httpOnly, secure, sameSite must match)
  const cookieOptions = {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  res.clearCookie('zerodrive_token', cookieOptions);
  res.clearCookie('zerodrive_refresh', cookieOptions);

  // CSRF token is not httpOnly (frontend needs to read it)
  res.clearCookie('zerodrive_csrf', {
    httpOnly: false,
    secure: NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  res.apiSuccess({}, 'Logged out successfully');
}));

/**
 * GET /api/auth/google-token
 * Get Google access token for authenticated user
 * Returns token info for Google Drive API access
 */
router.get('/google-token', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw ApiErrors.Unauthorized('Not authenticated');
  }

  // Fetch Google token from database
  const result = await query(
    'SELECT access_token, refresh_token, token_expiry, scope FROM user_google_tokens WHERE user_id = $1',
    [req.user.email]
  );

  if (result.rows.length === 0) {
    throw ApiErrors.NotFound('No Google token found. Please re-authenticate.');
  }

  const tokenData = result.rows[0];
  const now = new Date();
  const isExpired = new Date(tokenData.token_expiry) <= now;

  // If token is expired and we have refresh token, refresh it
  if (isExpired && tokenData.refresh_token) {
    logger.info('[Auth] Access token expired, refreshing...', {
      emailHash: req.user.emailHash,
    });

    try {
      const { refreshAccessToken } = require('../services/googleOAuthService');
      const newTokenData = await refreshAccessToken(tokenData.refresh_token);

      // Update database with new token
      const newExpiry = new Date(Date.now() + 3600 * 1000);
      await query(
        `UPDATE user_google_tokens
         SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [newTokenData.accessToken, newExpiry, req.user.email]
      );

      logger.info('[Auth] Successfully refreshed Google token', {
        emailHash: req.user.emailHash,
      });

      res.apiSuccess({
        accessToken: newTokenData.accessToken,
        expiresAt: newExpiry.toISOString(),
        scope: tokenData.scope,
      }, 'Google token retrieved (refreshed)');
      return;
    } catch (refreshError) {
      logger.error('[Auth] Failed to refresh Google token', refreshError as Error);
      throw ApiErrors.Unauthorized('Google token expired and refresh failed. Please re-authenticate.');
    }
  }

  if (isExpired && !tokenData.refresh_token) {
    throw ApiErrors.Unauthorized('Google token expired and no refresh token available. Please re-authenticate.');
  }

  res.apiSuccess({
    accessToken: tokenData.access_token,
    expiresAt: tokenData.token_expiry,
    scope: tokenData.scope,
  }, 'Google token retrieved');
}));

export default router;
