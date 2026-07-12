import request from "supertest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import analyticsRouter from "../../routes/analytics";
import { responseHelpers, errorHandler } from "../../middleware/errorHandler";
import { requireAuth } from "../../middleware/auth";
import { generateToken } from "../../services/jwtService";

jest.mock("../../config/database");
jest.mock("../../services/analytics");

const mockGetAnalyticsSummary = jest.fn();
const mockGetDailyStats = jest.fn();
const mockGetDimensionStats = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock("../../services/analytics", () => ({
  getAnalyticsSummary: (...args: any[]) => mockGetAnalyticsSummary(...args),
  getDailyStats: (...args: any[]) => mockGetDailyStats(...args),
  getDimensionStats: (...args: any[]) => mockGetDimensionStats(...args),
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    FILE_ADDED_TO_DRIVE: "file_added_to_drive",
  },
  AnalyticsCategory: {
    FILES: "files",
  },
}));

describe("Analytics Routes Integration", () => {
  let app: Application;
  const testUserEmail = "test@example.com";
  const csrfToken = "test-csrf-token";

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use(requireAuth);
    app.use("/api/analytics", analyticsRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function authCookie(): string {
    return `zerodrive_token=${generateToken(testUserEmail)}`;
  }

  describe("GET /api/analytics/summary", () => {
    it("returns the default 30-day anonymous summary", async () => {
      const mockSummary = {
        totalEvents: 3,
        eventsByType: { file_added_to_drive: 3 },
        eventsByCategory: { files: 3 },
      };
      mockGetAnalyticsSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get("/api/analytics/summary")
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockSummary);
      const [startDate, endDate] = mockGetAnalyticsSummary.mock.calls[0];
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(30);
    });

    it("uses a bounded custom day range", async () => {
      mockGetAnalyticsSummary.mockResolvedValue({
        totalEvents: 0,
        eventsByType: {},
        eventsByCategory: {},
      });

      const response = await request(app)
        .get("/api/analytics/summary")
        .query({ days: 7 })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("7 days");
    });

    it.each(["0", "-1", "abc", "7.5", String(Number.MAX_SAFE_INTEGER)])(
      "rejects invalid days=%s",
      async (days) => {
        const response = await request(app)
          .get("/api/analytics/summary")
          .query({ days })
          .set("Cookie", [authCookie()]);

        expect(response.status).toBe(422);
        expect(response.body.success).toBe(false);
        expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
      },
    );

    it("requires authentication", async () => {
      const response = await request(app).get("/api/analytics/summary");

      expect(response.status).toBe(401);
      expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
    });

    it("rejects an authenticated non-administrator", async () => {
      const response = await request(app)
        .get("/api/analytics/summary")
        .set("Cookie", [
          `zerodrive_token=${generateToken("user@example.com")}`,
        ]);

      expect(response.status).toBe(403);
      expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
    });

    it("does not expose analytics when the deployment has disabled them", async () => {
      process.env.ANALYTICS_ENABLED = "false";
      try {
        const response = await request(app)
          .get("/api/analytics/summary")
          .set("Cookie", [authCookie()]);

        expect(response.status).toBe(503);
        expect(mockGetAnalyticsSummary).not.toHaveBeenCalled();
      } finally {
        process.env.ANALYTICS_ENABLED = "true";
      }
    });
  });

  describe("GET /api/analytics/dimensions", () => {
    it("returns privacy-suppressed aggregate buckets to an administrator", async () => {
      const buckets = [
        {
          metric: "file_added_to_drive",
          dimension: "source",
          bucket: "upload",
          count: 12,
          suppressed: false,
        },
      ];
      mockGetDimensionStats.mockResolvedValue(buckets);

      const response = await request(app)
        .get("/api/analytics/dimensions")
        .query({ days: 30 })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(buckets);
      expect(mockGetDimensionStats).toHaveBeenCalledWith(30);
      expect(response.headers["cache-control"]).toContain("no-store");
    });
  });

  describe("GET /api/analytics/daily", () => {
    it("returns daily anonymous counters", async () => {
      const mockDailyStats = [
        {
          date: "2026-07-06",
          logins: 1,
          filesAdded: 2,
          shares: 3,
          downloads: 4,
        },
      ];
      mockGetDailyStats.mockResolvedValue(mockDailyStats);

      const response = await request(app)
        .get("/api/analytics/daily")
        .query({ days: 14 })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockDailyStats);
      expect(mockGetDailyStats).toHaveBeenCalledWith(14);
    });

    it.each(["0", "-10", "abc"])("rejects invalid days=%s", async (days) => {
      const response = await request(app)
        .get("/api/analytics/daily")
        .query({ days })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(422);
      expect(mockGetDailyStats).not.toHaveBeenCalled();
    });

    it("requires authentication", async () => {
      const response = await request(app).get("/api/analytics/daily");

      expect(response.status).toBe(401);
      expect(mockGetDailyStats).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/analytics/track", () => {
    it("returns tracked=false without calling the service when disabled", async () => {
      process.env.ANALYTICS_ENABLED = "false";
      try {
        const response = await request(app)
          .post("/api/analytics/track")
          .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
          .set("x-csrf-token", csrfToken)
          .send({ event: "file_added_to_drive" });

        expect(response.status).toBe(200);
        expect(response.body.data.tracked).toBe(false);
        expect(mockTrackEvent).not.toHaveBeenCalled();
      } finally {
        process.env.ANALYTICS_ENABLED = "true";
      }
    });

    it("accepts only the frontend-safe file-added event", async () => {
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/analytics/track")
        .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
        .set("x-csrf-token", csrfToken)
        .send({
          event: "file_added_to_drive",
          category: "files",
          metadata: { source: "upload" },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.tracked).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "file_added_to_drive",
        "files",
        {
          source: "upload",
        },
      );
    });

    it("defaults the frontend-safe event to the files category", async () => {
      mockTrackEvent.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/analytics/track")
        .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
        .set("x-csrf-token", csrfToken)
        .send({ event: "file_added_to_drive" });

      expect(response.status).toBe(200);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "file_added_to_drive",
        "files",
        undefined,
      );
    });

    it.each([
      { event: "user_login", category: "auth" },
      { event: "file_shared", category: "sharing" },
      { event: "file_added", category: "files" },
      { event: "file_added_to_drive", category: "sharing" },
      {
        event: "file_added_to_drive",
        category: "files",
        metadata: { email: "a@b.com" },
      },
      {
        event: "file_added_to_drive",
        category: "files",
        metadata: { source: "other" },
      },
    ])("rejects non-contract tracking payload %#", async (payload) => {
      const response = await request(app)
        .post("/api/analytics/track")
        .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
        .set("x-csrf-token", csrfToken)
        .send(payload);

      expect(response.status).toBe(422);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("requires CSRF protection", async () => {
      const response = await request(app)
        .post("/api/analytics/track")
        .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
        .send({ event: "file_added_to_drive" });

      expect(response.status).toBe(403);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("does not hide tracking service failures", async () => {
      mockTrackEvent.mockRejectedValue(new Error("Tracking service failed"));

      const response = await request(app)
        .post("/api/analytics/track")
        .set("Cookie", [authCookie(), `zerodrive_csrf=${csrfToken}`])
        .set("x-csrf-token", csrfToken)
        .send({ event: "file_added_to_drive" });

      expect(response.status).toBe(500);
    });
  });
});
