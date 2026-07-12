import {
  AnalyticsCategory,
  AnalyticsEvent,
  cleanupAnalyticsRetention,
  getAnalyticsSummary,
  getDailyStats,
  getDimensionStats,
  getFileSizeBucket,
  getFileTypeCategory,
  trackEvent,
} from "../../../services/analytics";

const mockQuery = jest.fn();
jest.mock("../../../config/database", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

describe("privacy-safe analytics service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANALYTICS_ENABLED = "true";
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("trackEvent", () => {
    it("does nothing while analytics are disabled", async () => {
      process.env.ANALYTICS_ENABLED = "false";

      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
      );

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("increments one total and separate one-dimensional buckets", async () => {
      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        {
          source: "upload",
          size_bucket: "1-10MB",
          file_category: "image",
        },
      );

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(mockQuery.mock.calls[0][0]).toContain(
        "INSERT INTO analytics_daily_summary",
      );
      expect(mockQuery.mock.calls[0][0]).toContain(
        "total_files_added_to_drive",
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("analytics_daily_dimensions"),
        ["file_added_to_drive", "source", "upload"],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("analytics_daily_dimensions"),
        ["file_added_to_drive", "size_bucket", "1-10MB"],
      );
    });

    it("rejects unknown metadata instead of sanitizing and storing it", async () => {
      await trackEvent(
        AnalyticsEvent.FILE_ADDED_TO_DRIVE,
        AnalyticsCategory.FILES,
        { email: "person@example.com" },
      );

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("rejects an event with the wrong category", async () => {
      await trackEvent(AnalyticsEvent.FILE_SHARED, AnalyticsCategory.AUTH);

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("does not break product behavior when PostgreSQL is unavailable", async () => {
      mockQuery.mockRejectedValue(new Error("database unavailable"));

      await expect(
        trackEvent(AnalyticsEvent.USER_LOGIN, AnalyticsCategory.AUTH),
      ).resolves.toBeUndefined();
    });
  });

  it("returns a typed summary without double-counting login subtypes", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          existing_logins: "80",
          new_users: "20",
          limited_scope_logins: "5",
          downloads: "50",
          files_added: "75",
          shares: "30",
          invitations: "15",
          key_setups: "4",
          key_rotations: "2",
          shares_finalized: "25",
          shares_revoked: "3",
        },
      ],
    });

    const summary = await getAnalyticsSummary(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-07-01T00:00:00Z"),
    );

    expect(summary.rangeDays).toBe(30);
    expect(summary.totals).toEqual({
      logins: 105,
      newUsers: 20,
      limitedScopeLogins: 5,
      filesAdded: 75,
      shares: 30,
      downloads: 50,
      invitations: 15,
      keySetups: 4,
      keyRotations: 2,
      sharesFinalized: 25,
      sharesRevoked: 3,
    });
    expect(summary.categories).toEqual({
      auth: 105,
      files: 75,
      sharing: 123,
      keys: 6,
    });
    expect(summary.totalEvents).toBe(309);
  });

  it("returns chronological daily aggregate points using a bound day value", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          date: "2026-07-01",
          existing_logins: "4",
          new_users: "1",
          limited_scope_logins: "1",
          files_added: "3",
          shares: "2",
          downloads: "1",
          invitations: "0",
          key_setups: "1",
          key_rotations: "2",
          shares_finalized: "2",
          shares_revoked: "1",
        },
      ],
    });

    const daily = await getDailyStats(7);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("$1::integer"),
      [7],
    );
    expect(daily[0]).toEqual({
      date: "2026-07-01",
      logins: 6,
      newUsers: 1,
      limitedScopeLogins: 1,
      filesAdded: 3,
      shares: 2,
      downloads: 1,
      invitations: 0,
      keySetups: 1,
      keyRotations: 2,
      sharesFinalized: 2,
      sharesRevoked: 1,
    });
  });

  it("suppresses dimension counts smaller than five", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          metric: "file_added_to_drive",
          dimension: "source",
          bucket: "upload",
          count: 4,
        },
        {
          metric: "file_shared",
          dimension: "size_bucket",
          bucket: "1-10MB",
          count: 8,
        },
      ],
    });

    const buckets = await getDimensionStats(30);

    expect(buckets[0]).toMatchObject({ count: null, suppressed: true });
    expect(buckets[1]).toMatchObject({ count: 8, suppressed: false });
  });

  it("purges daily totals and dimensions older than 365 days", async () => {
    await cleanupAnalyticsRetention();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[0][0]).toContain(
      "DELETE FROM analytics_daily_dimensions",
    );
    expect(mockQuery.mock.calls[1][0]).toContain(
      "DELETE FROM analytics_daily_summary",
    );
  });

  it("uses coarse file size ranges", () => {
    const MB = 1024 * 1024;
    expect(getFileSizeBucket(1)).toBe("<1MB");
    expect(getFileSizeBucket(5 * MB)).toBe("1-10MB");
    expect(getFileSizeBucket(25 * MB)).toBe("10-50MB");
    expect(getFileSizeBucket(75 * MB)).toBe("50-100MB");
    expect(getFileSizeBucket(200 * MB)).toBe(">100MB");
  });

  it("uses broad file categories", () => {
    expect(getFileTypeCategory("image/jpeg")).toBe("image");
    expect(getFileTypeCategory("application/pdf")).toBe("document");
    expect(getFileTypeCategory("application/zip")).toBe("archive");
    expect(getFileTypeCategory("custom/type")).toBe("other");
    expect(getFileTypeCategory("")).toBe("unknown");
  });
});
