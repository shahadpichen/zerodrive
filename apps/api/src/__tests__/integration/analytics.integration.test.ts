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
const mockGetMonthlyStats = jest.fn();
const mockGetMonthlyDimensionStats = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock("../../services/analytics", () => ({
  getAnalyticsSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
  getDailyStats: (...args: unknown[]) => mockGetDailyStats(...args),
  getDimensionStats: (...args: unknown[]) => mockGetDimensionStats(...args),
  getMonthlyStats: (...args: unknown[]) => mockGetMonthlyStats(...args),
  getMonthlyDimensionStats: (...args: unknown[]) =>
    mockGetMonthlyDimensionStats(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

  function utcDateOffset(days: number): string {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
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
      expect(daysDiff).toBe(29);
    });

    it("accepts an explicit bounded date range", async () => {
      mockGetAnalyticsSummary.mockResolvedValue({ totalEvents: 0 });

      const response = await request(app)
        .get("/api/analytics/summary")
        .query({ from: "2026-07-01", to: "2026-07-12" })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      const [startDate, endDate] = mockGetAnalyticsSummary.mock.calls[0];
      expect(startDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
      expect(endDate.toISOString()).toBe("2026-07-12T00:00:00.000Z");
    });

    it.each([
      { from: "2026-07-01" },
      { from: "2026/07/01", to: "2026-07-12" },
      { from: "2026-07-12", to: "2026-07-01" },
      { from: "2026-02-30", to: "2026-03-02" },
      { from: utcDateOffset(-400), to: utcDateOffset(0) },
      { from: utcDateOffset(0), to: utcDateOffset(1) },
    ])("rejects an unsafe date range %#", async (query) => {
      const response = await request(app)
        .get("/api/analytics/summary")
        .query(query)
        .set("Cookie", [authCookie()]);
      expect(response.status).toBe(422);
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
      const [startDate, endDate] = mockGetDimensionStats.mock.calls[0];
      expect(endDate.getTime() - startDate.getTime()).toBe(
        29 * 24 * 60 * 60 * 1000,
      );
      expect(response.headers["cache-control"]).toContain("no-store");
    });

    it("passes an exact calendar range to the dimension query", async () => {
      mockGetDimensionStats.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/analytics/dimensions")
        .query({ from: "2026-07-01", to: "2026-07-12" })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(mockGetDimensionStats).toHaveBeenCalledWith(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-12T00:00:00.000Z"),
      );
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
      const [startDate, endDate] = mockGetDailyStats.mock.calls[0];
      expect(endDate.getTime() - startDate.getTime()).toBe(
        13 * 24 * 60 * 60 * 1000,
      );
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

    it("passes an exact calendar range to the daily query", async () => {
      mockGetDailyStats.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/analytics/daily")
        .query({ from: "2026-07-01", to: "2026-07-12" })
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(mockGetDailyStats).toHaveBeenCalledWith(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-12T00:00:00.000Z"),
      );
    });
  });

  describe("GET /api/analytics/monthly", () => {
    it("returns long-term monthly aggregates", async () => {
      mockGetMonthlyStats.mockResolvedValue([
        { month: "2025-01-01", pageViews: 12, totalEvents: 18 },
      ]);
      const response = await request(app)
        .get("/api/analytics/monthly")
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(mockGetMonthlyStats).toHaveBeenCalledWith();
      expect(response.body.data[0].pageViews).toBe(12);
    });

    it("returns the complete permanent monthly archive", async () => {
      mockGetMonthlyStats.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/analytics/monthly")
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(mockGetMonthlyStats).toHaveBeenCalledWith();
      expect(response.body.message).toContain("Complete monthly");
    });
  });

  describe("GET /api/analytics/monthly/dimensions", () => {
    it("returns permanent monthly buckets", async () => {
      mockGetMonthlyDimensionStats.mockResolvedValue([
        {
          metric: "page_view",
          dimension: "page",
          bucket: "docs",
          count: 20,
          suppressed: false,
        },
      ]);
      const response = await request(app)
        .get("/api/analytics/monthly/dimensions")
        .set("Cookie", [authCookie()]);

      expect(response.status).toBe(200);
      expect(mockGetMonthlyDimensionStats).toHaveBeenCalledWith();
      expect(response.body.data[0].bucket).toBe("docs");
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
