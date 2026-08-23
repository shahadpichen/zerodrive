/**
 * Integration Tests for Auth Routes
 * Tests authentication endpoints with cookies and CSRF tokens
 */

import request from "supertest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import authRouter from "../../routes/auth";
import { responseHelpers, errorHandler } from "../../middleware/errorHandler";
import { generateToken, generateRefreshToken } from "../../services/jwtService";
import { deriveLookupCandidates } from "../../utils/identity";

// Mock dependencies
jest.mock("../../services/googleOAuthService");
jest.mock("../../config/database");
jest.mock("../../services/analytics");

const mockQuery = jest.fn();
jest.mock("../../config/database", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockGetAuthUrl = jest.fn();
const mockGetTokensFromCode = jest.fn();
const mockGetUserInfo = jest.fn();
const mockHasRequiredGoogleDriveScopes = jest.fn();
const mockRefreshAccessToken = jest.fn();

jest.mock("../../services/googleOAuthService", () => ({
  getAuthUrl: (...args: any[]) => mockGetAuthUrl(...args),
  getTokensFromCode: (...args: any[]) => mockGetTokensFromCode(...args),
  getUserInfo: (...args: any[]) => mockGetUserInfo(...args),
  hasRequiredGoogleDriveScopes: (...args: any[]) =>
    mockHasRequiredGoogleDriveScopes(...args),
  refreshAccessToken: (...args: any[]) => mockRefreshAccessToken(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock("../../services/analytics", () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    USER_LOGIN_NEW: "user_login_new",
    USER_LOGIN_EXISTING: "user_login_existing",
    USER_LOGIN_LIMITED_SCOPE: "user_login_limited_scope",
  },
  AnalyticsCategory: {
    AUTH: "auth",
  },
}));

describe("Auth Routes Integration", () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use("/api/auth", authRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "development";
  });

  describe("GET /api/auth/google", () => {
    it("should redirect to Google OAuth URL", async () => {
      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?...";
      mockGetAuthUrl.mockReturnValue(authUrl);

      const response = await request(app).get("/api/auth/google");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(authUrl);
      expect(mockGetAuthUrl).toHaveBeenCalled();
    });

    it("should redirect to frontend with error if OAuth init fails", async () => {
      mockGetAuthUrl.mockImplementation(() => {
        throw new Error("OAuth config error");
      });

      const response = await request(app).get("/api/auth/google");

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=oauth_init_failed");
    });
  });

  describe("GET /api/auth/callback/google", () => {
    const mockCode = "mock-oauth-code";
    const mockAccessToken = "mock-google-access-token";
    const mockRefreshToken = "mock-google-refresh-token";
    const mockUserEmail = "test@example.com";

    beforeEach(() => {
      mockGetAuthUrl.mockReturnValue("https://accounts.google.com/oauth");
      mockGetTokensFromCode.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        scope: "https://www.googleapis.com/auth/drive",
      });

      mockGetUserInfo.mockResolvedValue({
        email: mockUserEmail,
        verified: true,
      });

      mockHasRequiredGoogleDriveScopes.mockReturnValue(true);

      // Mock database query - no existing public key (new user)
      mockQuery.mockResolvedValue({ rows: [] });
    });

    async function callback(query: Record<string, string>) {
      const start = await request(app).get("/api/auth/google");
      const state = mockGetAuthUrl.mock.calls.at(-1)?.[0];
      const stateCookie = (
        start.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("zerodrive_oauth_state="))!;
      return request(app)
        .get("/api/auth/callback/google")
        .set("Cookie", [stateCookie.split(";")[0]])
        .query({ ...query, state });
    }

    it("should handle successful OAuth callback for new user", async () => {
      const response = await callback({ code: mockCode });

      expect(response.status).toBe(302);

      // Verify redirect includes tokens in URL (zero-knowledge architecture)
      const redirectUrl = response.headers.location as string;
      expect(redirectUrl).toContain("http://localhost:3000/oauth/callback");
      expect(redirectUrl).toContain("exchange=");
      expect(redirectUrl).not.toContain("tokens=");
      expect(redirectUrl).not.toContain(mockAccessToken);
      expect(response.headers["referrer-policy"]).toBe("no-referrer");

      // Verify cookies were set
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(
        cookies.some((c: string) => c.startsWith("zerodrive_token=")),
      ).toBe(true);
      expect(
        cookies.some((c: string) => c.startsWith("zerodrive_refresh=")),
      ).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("zerodrive_csrf="))).toBe(
        true,
      );
      expect(
        cookies.some(
          (c: string) =>
            c.startsWith("zerodrive_google_refresh=") && c.includes("HttpOnly"),
        ),
      ).toBe(true);

      // Google tokens are NO LONGER stored in database (zero-knowledge architecture)
      // They are passed once through the authenticated exchange endpoint.
      // Identity migration and the existing-user check are one atomic statement.
      const lookupIds = deriveLookupCandidates(mockUserEmail);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("migrated_shares"),
        [lookupIds[0], lookupIds[1], lookupIds],
      );

      // Verify analytics tracked
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it("should handle existing user login", async () => {
      // Mock existing public key (existing user)
      mockQuery.mockResolvedValueOnce({
        rows: [{ user_id: mockUserEmail }],
      });

      mockQuery.mockResolvedValueOnce({ rows: [] }); // For token upsert

      const response = await callback({ code: mockCode });

      expect(response.status).toBe(302);
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it("should redirect with error when no code provided", async () => {
      const response = await callback({});

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=no_code");
    });

    it("should redirect with error when OAuth error in query", async () => {
      const response = await callback({ error: "access_denied" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=access_denied");
    });

    it("should redirect with error when email is not verified", async () => {
      mockGetUserInfo.mockResolvedValue({
        email: mockUserEmail,
        verified: false,
      });

      const response = await callback({ code: mockCode });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=email_not_verified");
    });

    it("should set httpOnly cookies with correct attributes", async () => {
      const response = await callback({ code: mockCode });

      const cookies = response.headers["set-cookie"] as unknown as string[];

      const tokenCookie = cookies.find((c: string) =>
        c.startsWith("zerodrive_token="),
      );
      expect(tokenCookie).toContain("HttpOnly");
      expect(tokenCookie).toContain("SameSite=Lax");
      expect(tokenCookie).toContain("Path=/");

      const csrfCookie = cookies.find((c: string) =>
        c.startsWith("zerodrive_csrf="),
      );
      expect(csrfCookie).not.toContain("HttpOnly"); // CSRF should NOT be httpOnly
    });

    it("rejects callbacks with an invalid state before exchanging code", async () => {
      const response = await request(app)
        .get("/api/auth/callback/google")
        .set("Cookie", ["zerodrive_oauth_state=expected"])
        .query({ code: mockCode, state: "attacker" });

      expect(response.headers.location).toContain("error=invalid_state");
      expect(mockGetTokensFromCode).not.toHaveBeenCalled();
    });

    it("allows an exchange code exactly once", async () => {
      let exchangeConsumed = false;
      mockQuery.mockImplementation(async (sql: string) => {
        if (
          sql.includes("DELETE FROM oauth_exchanges") &&
          sql.includes("RETURNING id")
        ) {
          if (exchangeConsumed) return { rows: [], rowCount: 0 };
          exchangeConsumed = true;
          return {
            rows: [{ id: "00000000-0000-4000-8000-000000000001" }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const callbackResponse = await callback({ code: mockCode });
      const exchangeCode = new URL(
        callbackResponse.headers.location as string,
      ).searchParams.get("exchange")!;
      const setCookies = callbackResponse.headers[
        "set-cookie"
      ] as unknown as string[];
      const cookies = setCookies.map((cookie) => cookie.split(";")[0]);
      const csrf = cookies
        .find((cookie) => cookie.startsWith("zerodrive_csrf="))!
        .split("=")[1];

      const first = await request(app)
        .post("/api/auth/exchange")
        .set("Cookie", cookies)
        .set("x-csrf-token", csrf)
        .send({ code: exchangeCode });
      expect(first.status).toBe(200);
      expect(first.body.data.accessToken).toBe(mockAccessToken);

      await request(app)
        .post("/api/auth/exchange")
        .set("Cookie", cookies)
        .set("x-csrf-token", csrf)
        .send({ code: exchangeCode })
        .expect(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user info when authenticated", async () => {
      const userEmail = "test@example.com";
      const token = generateToken(userEmail);

      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userEmail);
      expect(response.body.data.emailHash).toBeDefined();
      expect(response.body.data.capabilities).toEqual({
        analyticsRead: true,
      });
    });

    it("should return 401 when no token cookie provided", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });

    it("should return 401 when token is invalid", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["zerodrive_token=invalid.token.here"]);

      expect(response.status).toBe(401);
    });
  });

  describe("Legal acceptance", () => {
    const userEmail = "test@example.com";
    const csrf = "legal-acceptance-csrf";

    function authenticatedRequest(method: "get" | "post") {
      const token = generateToken(userEmail);
      const requestBuilder = request(app)[method](
        "/api/auth/legal-acceptance",
      ).set("Cookie", [
        `zerodrive_token=${token}`,
        `zerodrive_csrf=${csrf}`,
      ]);

      if (method === "post") {
        requestBuilder.set("x-csrf-token", csrf).send({});
      }

      return requestBuilder;
    }

    it("returns current legal versions and unaccepted status", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await authenticatedRequest("get");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        accepted: false,
        required: true,
        termsVersion: "2026-08",
        privacyVersion: "2026-08",
        acceptedAt: null,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM legal_acceptances"),
        [expect.stringMatching(/^[0-9a-f]{64}$/), "2026-08", "2026-08"],
      );
    });

    it("records acceptance for the authenticated account lookup", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ accepted_at: new Date("2026-08-08T00:00:00.000Z") }],
      });

      const response = await authenticatedRequest("post");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        accepted: true,
        required: true,
        termsVersion: "2026-08",
        privacyVersion: "2026-08",
        acceptedAt: "2026-08-08T00:00:00.000Z",
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO legal_acceptances"),
        [expect.stringMatching(/^[0-9a-f]{64}$/), "2026-08", "2026-08"],
      );
    });

    it("requires CSRF protection when recording acceptance", async () => {
      const token = generateToken(userEmail);
      const response = await request(app)
        .post("/api/auth/legal-acceptance")
        .set("Cookie", [`zerodrive_token=${token}`])
        .send({});

      expect(response.status).toBe(403);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh access token with valid refresh token", async () => {
      const userEmail = "test@example.com";
      const refreshToken = generateRefreshToken(userEmail);

      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`zerodrive_refresh=${refreshToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new access token cookie was set
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(
        cookies.some((c: string) => c.startsWith("zerodrive_token=")),
      ).toBe(true);
    });

    it("should return 401 when no refresh token provided", async () => {
      const response = await request(app).post("/api/auth/refresh");

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain("No refresh token");
    });

    it("should return 401 when refresh token is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", ["zerodrive_refresh=invalid.token.here"]);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear all auth cookies", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify cookies were cleared
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();

      const tokenCookie = cookies.find((c: string) =>
        c.includes("zerodrive_token="),
      );
      const refreshCookie = cookies.find((c: string) =>
        c.includes("zerodrive_refresh="),
      );
      const csrfCookie = cookies.find((c: string) =>
        c.includes("zerodrive_csrf="),
      );

      // Cleared cookies should have expired date
      expect(tokenCookie).toContain("Thu, 01 Jan 1970");
      expect(refreshCookie).toContain("Thu, 01 Jan 1970");
      expect(csrfCookie).toContain("Thu, 01 Jan 1970");
    });

    it("should succeed even without auth cookie", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(200);
    });
  });

  // ENDPOINT REMOVED: /api/auth/google-token (Risk #35 - Zero-knowledge architecture)
  // Google tokens are now encrypted client-side and never stored in database
  // Backend passes tokens once via URL redirect during OAuth callback
  // See: apps/api/src/routes/auth.ts (lines 140-151)
  // See: apps/web/src/utils/authService.ts (storeGoogleTokens function)
  //
  // describe('GET /api/auth/google-token', () => {
  //   // Tests removed - endpoint no longer exists
  // });

  describe("POST /api/auth/google/refresh", () => {
    const mockGoogleRefreshToken = "mock-google-refresh-token";
    const mockNewAccessToken = "mock-new-google-access-token";

    beforeEach(() => {
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });
    });

    function authenticatedGoogleRefresh(refreshToken = mockGoogleRefreshToken) {
      const csrf = "google-refresh-csrf";
      return request(app)
        .post("/api/auth/google/refresh")
        .set("Cookie", [
          `zerodrive_token=${generateToken("test@example.com")}`,
          `zerodrive_csrf=${csrf}`,
          `zerodrive_google_refresh=${refreshToken}`,
        ])
        .set("x-csrf-token", csrf)
        .send({});
    }

    it("should refresh Google access token with valid refresh token", async () => {
      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe(mockNewAccessToken);
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.message).toBe("Google access token refreshed");

      expect(mockRefreshAccessToken).toHaveBeenCalledWith(
        mockGoogleRefreshToken,
      );
    });

    it("should return valid ISO timestamp for expiry", async () => {
      const beforeRequest = new Date();
      const response = await authenticatedGoogleRefresh();
      const afterRequest = new Date(Date.now() + 3600 * 1000); // +1 hour

      expect(response.status).toBe(200);
      expect(response.body.data.expiresAt).toBeDefined();

      const expiresAt = new Date(response.body.data.expiresAt);
      expect(expiresAt.toISOString()).toBe(response.body.data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(beforeRequest.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it("should calculate expiry approximately 1 hour from now", async () => {
      const response = await authenticatedGoogleRefresh();

      const expiresAt = new Date(response.body.data.expiresAt);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600 * 1000);

      // Allow 1 second tolerance for test execution time
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        oneHourFromNow.getTime() - 1000,
      );
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        oneHourFromNow.getTime() + 1000,
      );
    });

    it("requires an authenticated session and refresh cookie", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("rejects a null body token", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: null });

      expect(response.status).toBe(401);
    });

    it("rejects a numeric body token", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: 12345 });

      expect(response.status).toBe(401);
    });

    it("rejects an empty body token", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: "" });

      expect(response.status).toBe(401);
    });

    it("should return 401 when Google refresh fails", async () => {
      mockRefreshAccessToken.mockRejectedValue(
        new Error("Invalid refresh token"),
      );

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain(
        "Failed to refresh Google access token",
      );
    });

    it("should return 401 when refresh token is expired", async () => {
      mockRefreshAccessToken.mockRejectedValue(
        new Error("Token has been expired or revoked"),
      );

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when refresh token is revoked", async () => {
      mockRefreshAccessToken.mockRejectedValue(
        new Error("Token has been revoked"),
      );

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("requires JWT and CSRF authentication", async () => {
      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should handle whitespace-only refresh token", async () => {
      // Whitespace-only string passes validation but fails at Google OAuth level
      mockRefreshAccessToken.mockRejectedValue(
        new Error("Invalid refresh token"),
      );

      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: "   " });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("does not accept a body token even with extra fields", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({
          refreshToken: mockGoogleRefreshToken,
          extraField: "should-be-ignored",
          anotherField: 123,
        });

      expect(response.status).toBe(401);
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("rejects special-character body tokens", async () => {
      const specialToken = "token-with-special-chars-!@#$%^&*()";
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });

      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: specialToken });

      expect(response.status).toBe(401);
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("rejects very long body tokens", async () => {
      const longToken = "a".repeat(1000);
      mockRefreshAccessToken.mockResolvedValue({
        accessToken: mockNewAccessToken,
      });

      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: longToken });

      expect(response.status).toBe(401);
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("should handle Google API rate limit error", async () => {
      mockRefreshAccessToken.mockRejectedValue(
        new Error("Rate limit exceeded"),
      );

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should handle network error during refresh", async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error("Network error"));

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should handle malformed JSON body gracefully", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .set("Content-Type", "application/json")
        .send('{"refreshToken": invalid}');

      expect(response.status).toBe(400);
    });

    it("should handle array instead of object", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send([mockGoogleRefreshToken]);

      expect(response.status).toBe(401);
    });

    it("should return different access tokens on repeated calls", async () => {
      mockRefreshAccessToken
        .mockResolvedValueOnce({ accessToken: "token-1" })
        .mockResolvedValueOnce({ accessToken: "token-2" });

      const response1 = await authenticatedGoogleRefresh();

      const response2 = await authenticatedGoogleRefresh();

      expect(response1.body.data.accessToken).toBe("token-1");
      expect(response2.body.data.accessToken).toBe("token-2");
    });

    it("should handle Google OAuth service throwing non-Error object", async () => {
      mockRefreshAccessToken.mockRejectedValue("string error");

      const response = await authenticatedGoogleRefresh();

      expect(response.status).toBe(401);
    });

    it("should handle undefined refreshToken field", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send({ refreshToken: undefined });

      expect(response.status).toBe(401);
    });

    it("should handle empty request body", async () => {
      const response = await request(app)
        .post("/api/auth/google/refresh")
        .send();

      expect(response.status).toBe(401);
    });
  });
});
