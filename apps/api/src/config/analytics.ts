const TRUE_VALUES = new Set(["true", "1", "yes"]);

export function isAnalyticsEnabled(): boolean {
  return TRUE_VALUES.has(
    (process.env.ANALYTICS_ENABLED || "false").toLowerCase(),
  );
}

export function getAnalyticsAdminEmails(): Set<string> {
  return new Set(
    (process.env.ANALYTICS_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAnalyticsAdmin(email: string | undefined): boolean {
  if (!isAnalyticsEnabled() || !email) return false;
  return getAnalyticsAdminEmails().has(email.trim().toLowerCase());
}

export function validateAnalyticsConfig(): void {
  if (!isAnalyticsEnabled()) return;

  const admins = getAnalyticsAdminEmails();
  if (admins.size === 0) {
    throw new Error(
      "ANALYTICS_ADMIN_EMAILS must contain at least one administrator when analytics is enabled",
    );
  }

  const invalid = [...admins].filter(
    (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  );
  if (invalid.length > 0) {
    throw new Error("ANALYTICS_ADMIN_EMAILS contains an invalid email address");
  }
}
