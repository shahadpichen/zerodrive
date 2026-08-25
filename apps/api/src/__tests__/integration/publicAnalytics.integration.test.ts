import express, { type Application } from "express";
import request from "supertest";
import publicAnalyticsRouter from "../../routes/publicAnalytics";
import { errorHandler, responseHelpers } from "../../middleware/errorHandler";
import { ANALYTICS_PAGE_KEYS } from "@zerodrive/shared-types";

const mockTrackEvent = jest.fn();
jest.mock("../../services/analytics", () => ({
  AnalyticsEvent: { PAGE_VIEW: "page_view" },
  AnalyticsCategory: { NAVIGATION: "navigation" },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

describe("public privacy-safe page analytics", () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(responseHelpers);
    app.use("/api/analytics", publicAnalyticsRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANALYTICS_ENABLED = "true";
  });

  it.each(ANALYTICS_PAGE_KEYS)(
    "counts allowlisted page %s without authentication",
    async (page) => {
      const response = await request(app)
        .post("/api/analytics/page-view")
        .send({ page });

      expect(response.status).toBe(200);
      expect(response.body.data.tracked).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith("page_view", "navigation", {
        page,
      });
    },
  );

  it.each([
    { page: "/storage" },
    { page: "docs_security_model?email=person@example.com" },
    { page: "admin_analytics" },
    { page: "unknown" },
    { page: "home", referrer: "https://example.com" },
  ])("rejects raw or expanded tracking payload %#", async (payload) => {
    const response = await request(app)
      .post("/api/analytics/page-view")
      .send(payload);

    expect(response.status).toBe(422);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("is a no-op when deployment analytics are disabled", async () => {
    process.env.ANALYTICS_ENABLED = "false";
    const response = await request(app)
      .post("/api/analytics/page-view")
      .send({ page: "landing" });

    expect(response.status).toBe(200);
    expect(response.body.data.tracked).toBe(false);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it.each([{}, { page: null }, { page: 42 }, [], { page: "" }])(
    "rejects malformed page payload %#",
    async (payload) => {
      const response = await request(app)
        .post("/api/analytics/page-view")
        .send(payload);

      expect(response.status).toBe(422);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    },
  );

  it("returns a sanitized server error when aggregation fails", async () => {
    mockTrackEvent.mockRejectedValueOnce(new Error("private database detail"));

    const response = await request(app)
      .post("/api/analytics/page-view")
      .send({ page: "landing" });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain(
      "private database detail",
    );
  });
});
