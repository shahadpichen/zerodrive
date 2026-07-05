/**
 * Authentication Routes
 * Handles Google OAuth flow and session management
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  getAuthUrl,
  getTokensFromCode,
  getUserInfo,
  hasFullDriveScope,
  refreshAccessToken,
} from "../services/googleOAuthService";
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
} from "../services/jwtService";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, ApiErrors } from "../middleware/errorHandler";
import {
  trackEvent,
  AnalyticsEvent,
  AnalyticsCategory,
} from "../services/analytics";
import { query } from "../config/database";
import logger from "../utils/logger";
import { deriveLookupCandidates } from "../utils/identity";

const router = Router();

const FRONTEND_URL = process.env.APP_URL || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const oauthExchanges = new Map<
  string,
  {
    ownerHash: string;
    expiresAt: number;
    tokens: {
      accessToken: string;
      expiresAt: string;
      scope: string;
    };
    isNewUser: boolean;
    hasLimitedScope: boolean;
  }
>();

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get(
  "/google",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const state = crypto.randomBytes(32).toString("base64url");
      res.cookie("zerodrive_oauth_state", state, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000,
        path: "/api/auth/callback/google",
      });
      const authUrl = getAuthUrl(state);
      res.redirect(authUrl);
    } catch (error) {
      logger.error("[Auth] Failed to generate OAuth URL", error as Error);
      res.redirect(`${FRONTEND_URL}?error=oauth_init_failed`);
    }
  }),
);

/**
 * GET /api/auth/callback/google
 * Handle Google OAuth callback
 */
router.get(
  "/callback/google",
  asyncHandler(async (req: Request, res: Response) => {
    const { code, error, state } = req.query;
    const expectedState = req.cookies.zerodrive_oauth_state;
    res.clearCookie("zerodrive_oauth_state", {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/callback/google",
    });

    if (
      typeof state !== "string" ||
      typeof expectedState !== "string" ||
      state.length !== expectedState.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))
    ) {
      logger.warn("[Auth] OAuth state validation failed");
      return res.redirect(`${FRONTEND_URL}?error=invalid_state`);
    }

    // Handle OAuth errors
    if (error) {
      logger.warn("[Auth] OAuth callback error", { error });
      return res.redirect(`${FRONTEND_URL}?error=${error}`);
    }

    if (!code || typeof code !== "string") {
      logger.warn("[Auth] No authorization code in callback");
      return res.redirect(`${FRONTEND_URL}?error=no_code`);
    }

    try {
      // Exchange code for tokens
      const { accessToken, refreshToken, scope } =
        await getTokensFromCode(code);

      // Get user info from Google
      const userInfo = await getUserInfo(accessToken);

      if (!userInfo.verified) {
        logger.warn("[Auth] Unverified email attempted login", {
          email: userInfo.email,
        });
        return res.redirect(`${FRONTEND_URL}?error=email_not_verified`);
      }

      // Check if user is new (no public key in database)
      const lookupIds = deriveLookupCandidates(userInfo.email);
      const publicKeyResult = await query(
        "SELECT user_id FROM public_keys WHERE user_id = ANY($1::varchar[])",
        [lookupIds],
      );
      const isNewUser = publicKeyResult.rows.length === 0;

      // Check if user granted full Drive scope
      const hasLimitedScope = !hasFullDriveScope(scope);

      // NO LONGER STORING TOKENS IN DATABASE - Zero-knowledge architecture!
      // Frontend stores tokens in sessionStorage (cleared on tab close)
      const tokenExpiry = new Date(Date.now() + 3600 * 1000); // Access tokens typically expire in 1 hour

      logger.info("[Auth] Google tokens obtained (not storing in database)", {
        email: userInfo.email,
        hasRefreshToken: !!refreshToken,
      });

      // Track login analytics
      try {
        if (hasLimitedScope) {
          await trackEvent(
            AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE,
            AnalyticsCategory.AUTH,
          );
        } else if (isNewUser) {
          await trackEvent(
            AnalyticsEvent.USER_LOGIN_NEW,
            AnalyticsCategory.AUTH,
          );
        } else {
          await trackEvent(
            AnalyticsEvent.USER_LOGIN_EXISTING,
            AnalyticsCategory.AUTH,
          );
        }
      } catch (analyticsError) {
        logger.error(
          "[Auth] Failed to track login analytics",
          analyticsError as Error,
        );
        // Don't fail login if analytics fails
      }

      // Generate JWT access token (15 minutes)
      const jwtToken = generateToken(userInfo.email);

      // Generate JWT refresh token (7 days)
      const jwtRefreshToken = generateRefreshToken(userInfo.email);

      // Generate CSRF token
      const csrfToken = crypto.randomBytes(32).toString("hex");

      logger.info("[Auth] User authenticated successfully", {
        email: userInfo.email,
        isNewUser,
        hasLimitedScope,
      });

      // Set access token cookie (httpOnly, 15 minutes)
      res.cookie("zerodrive_token", jwtToken, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
        path: "/",
      });

      // Set JWT refresh token cookie (httpOnly, 7 days)
      res.cookie("zerodrive_refresh", jwtRefreshToken, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: "/",
      });

      // Set CSRF token cookie (readable by frontend)
      res.cookie("zerodrive_csrf", csrfToken, {
        httpOnly: false, // Frontend needs to read this
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // Same as refresh token
        path: "/",
      });
      if (refreshToken) {
        res.cookie("zerodrive_google_refresh", refreshToken, {
          httpOnly: true,
          secure: NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: "/api/auth",
        });
      }

      const exchangeCode = crypto.randomBytes(32).toString("base64url");
      const ownerHash = verifyToken(jwtToken).emailHash;
      oauthExchanges.set(exchangeCode, {
        ownerHash,
        expiresAt: Date.now() + 60_000,
        tokens: {
          accessToken,
          expiresAt: tokenExpiry.toISOString(),
          scope,
        },
        isNewUser,
        hasLimitedScope,
      });

      res.setHeader("Referrer-Policy", "no-referrer");
      res.redirect(`${FRONTEND_URL}/oauth/callback?exchange=${exchangeCode}`);
    } catch (error) {
      logger.error("[Auth] OAuth callback failed", error as Error);
      res.redirect(`${FRONTEND_URL}?error=auth_failed`);
    }
  }),
);

router.post(
  "/exchange",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;
    if (typeof code !== "string") {
      throw ApiErrors.BadRequest("Exchange code is required");
    }
    const exchange = oauthExchanges.get(code);
    oauthExchanges.delete(code);
    if (
      !exchange ||
      exchange.expiresAt <= Date.now() ||
      exchange.ownerHash !== req.user?.emailHash
    ) {
      throw ApiErrors.Unauthorized("Invalid or expired exchange code");
    }
    res.setHeader("Cache-Control", "no-store");
    res.apiSuccess(
      {
        ...exchange.tokens,
        isNewUser: exchange.isNewUser,
        hasLimitedScope: exchange.hasLimitedScope,
      },
      "OAuth exchange completed",
    );
  }),
);

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info("[Auth /me] Request received", {
      hasCookie: !!req.cookies.zerodrive_token,
      hasUser: !!req.user,
      path: req.path,
    });

    if (!req.user) {
      throw ApiErrors.Unauthorized("Not authenticated");
    }

    res.apiSuccess(
      {
        email: req.user.email,
        emailHash: req.user.emailHash,
      },
      "User info retrieved",
    );
  }),
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token from cookie
 */
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.zerodrive_refresh;

    if (!refreshToken) {
      throw ApiErrors.Unauthorized("No refresh token provided");
    }

    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Generate new access token
      const newAccessToken = generateToken(payload.email);

      // Set new access token cookie
      res.cookie("zerodrive_token", newAccessToken, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: "/",
      });

      logger.info("[Auth] Access token refreshed", {
        emailHash: payload.emailHash,
      });

      res.apiSuccess({}, "Token refreshed successfully");
    } catch (error) {
      logger.warn("[Auth] Token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw ApiErrors.Unauthorized("Invalid or expired refresh token");
    }
  }),
);

/**
 * POST /api/auth/google/refresh
 * Refresh Google access token using refresh token
 * No JWT auth required - uses Google refresh token from request body
 */
router.post(
  "/google/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      req.cookies.zerodrive_google_refresh || req.body.refreshToken;

    if (!refreshToken || typeof refreshToken !== "string") {
      throw ApiErrors.BadRequest("Refresh token is required");
    }

    try {
      // Use Google OAuth service to refresh the access token
      const { accessToken } = await refreshAccessToken(refreshToken);

      // Calculate new expiry (Google access tokens typically expire in 1 hour)
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      logger.info("[Auth] Google access token refreshed successfully");

      res.apiSuccess(
        {
          accessToken,
          expiresAt: expiresAt.toISOString(),
        },
        "Google access token refreshed",
      );
    } catch (error) {
      logger.warn("[Auth] Google token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw ApiErrors.Unauthorized("Failed to refresh Google access token");
    }
  }),
);

/**
 * POST /api/auth/logout
 * Logout user (clear all auth cookies)
 * No auth required - allows logout even with expired token
 */
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    logger.info("[Auth] User logged out");

    // Clear all auth cookies with matching options (httpOnly, secure, sameSite must match)
    const cookieOptions = {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    res.clearCookie("zerodrive_token", cookieOptions);
    res.clearCookie("zerodrive_refresh", cookieOptions);
    res.clearCookie("zerodrive_google_refresh", {
      ...cookieOptions,
      path: "/api/auth",
    });

    // CSRF token is not httpOnly (frontend needs to read it)
    res.clearCookie("zerodrive_csrf", {
      httpOnly: false,
      secure: NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    });

    res.apiSuccess({}, "Logged out successfully");
  }),
);

/**
 * ENDPOINT REMOVED - Zero-knowledge architecture
 * Google tokens are now encrypted and stored in frontend sessionStorage
 * Backend never stores or serves Google tokens
 * See: frontend authService.ts for encrypted storage implementation
 */

export default router;
