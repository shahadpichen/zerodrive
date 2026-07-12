import {
  getAnalyticsAdminEmails,
  isAnalyticsAdmin,
  isAnalyticsEnabled,
  validateAnalyticsConfig,
} from "../../../config/analytics";

describe("analytics deployment configuration", () => {
  const originalEnabled = process.env.ANALYTICS_ENABLED;
  const originalAdmins = process.env.ANALYTICS_ADMIN_EMAILS;

  afterEach(() => {
    process.env.ANALYTICS_ENABLED = originalEnabled;
    process.env.ANALYTICS_ADMIN_EMAILS = originalAdmins;
  });

  it("is disabled by default", () => {
    delete process.env.ANALYTICS_ENABLED;
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("normalizes a deployment-specific administrator allowlist", () => {
    process.env.ANALYTICS_ENABLED = "true";
    process.env.ANALYTICS_ADMIN_EMAILS =
      " Owner@Example.com, maintainer@example.com ";

    expect(getAnalyticsAdminEmails()).toEqual(
      new Set(["owner@example.com", "maintainer@example.com"]),
    );
    expect(isAnalyticsAdmin("OWNER@example.com")).toBe(true);
    expect(isAnalyticsAdmin("user@example.com")).toBe(false);
  });

  it("refuses to enable analytics without a valid administrator", () => {
    process.env.ANALYTICS_ENABLED = "true";
    delete process.env.ANALYTICS_ADMIN_EMAILS;
    expect(() => validateAnalyticsConfig()).toThrow("ANALYTICS_ADMIN_EMAILS");

    process.env.ANALYTICS_ADMIN_EMAILS = "not-an-email";
    expect(() => validateAnalyticsConfig()).toThrow("invalid email");
  });
});
