import analyticsTracker, {
  AnalyticsCategory,
  AnalyticsEvent,
  trackEvent,
  trackFileAddedToDrive,
  trackLogin,
} from "../../utils/analyticsTracker";

jest.mock("../../utils/apiClient");
jest.mock("../../utils/logger");

const mockPost = jest.fn();

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
  },
}));

describe("AnalyticsTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ success: true, data: {} });
  });

  it("posts only the frontend-safe file-added event", async () => {
    await trackEvent(
      AnalyticsEvent.FILE_ADDED_TO_DRIVE,
      AnalyticsCategory.FILES,
      {
        source: "upload",
      },
    );

    expect(mockPost).toHaveBeenCalledWith("/analytics/track", {
      event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
      category: AnalyticsCategory.FILES,
      metadata: { source: "upload" },
    });
  });

  it("defaults file-added events to the files category", async () => {
    await trackEvent(AnalyticsEvent.FILE_ADDED_TO_DRIVE);

    expect(mockPost).toHaveBeenCalledWith(
      "/analytics/track",
      expect.objectContaining({
        category: AnalyticsCategory.FILES,
        metadata: {},
      }),
    );
  });

  it("does not post auth or sharing events from the browser", async () => {
    await trackEvent(AnalyticsEvent.USER_LOGIN_NEW);
    await trackEvent(AnalyticsEvent.FILE_SHARED);
    await trackLogin(true, false);

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("does not throw when analytics upload fails", async () => {
    mockPost.mockRejectedValue(new Error("Network error"));

    await expect(trackFileAddedToDrive("upload")).resolves.not.toThrow();
  });

  it("tracks upload and download file-added sources", async () => {
    await trackFileAddedToDrive("upload");
    await trackFileAddedToDrive("download");

    expect(mockPost).toHaveBeenNthCalledWith(1, "/analytics/track", {
      event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
      category: AnalyticsCategory.FILES,
      metadata: { source: "upload" },
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/analytics/track", {
      event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
      category: AnalyticsCategory.FILES,
      metadata: { source: "download" },
    });
  });

  it("sends only coarse size and file-category buckets", async () => {
    await trackFileAddedToDrive("upload", 5 * 1024 * 1024, "image/png");

    expect(mockPost).toHaveBeenCalledWith("/analytics/track", {
      event: AnalyticsEvent.FILE_ADDED_TO_DRIVE,
      category: AnalyticsCategory.FILES,
      metadata: {
        source: "upload",
        size_bucket: "1-10MB",
        file_category: "image",
      },
    });
  });

  it("keeps the default export stable", () => {
    expect(analyticsTracker.trackEvent).toBe(trackEvent);
    expect(analyticsTracker.trackLogin).toBe(trackLogin);
    expect(analyticsTracker.trackFileAddedToDrive).toBe(trackFileAddedToDrive);
  });
});
