export interface SharedFileMetadata {
  version: 1;
  name: string;
  mimeType: string;
  message?: string;
  bindingId?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  stack?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  message?: string;
}

export interface AuthCapabilities {
  analyticsRead: boolean;
}

export interface AuthenticatedUser {
  email: string;
  emailHash: string;
  capabilities: AuthCapabilities;
}

/**
 * Deliberately reviewed analytics buckets. The analytics API accepts these
 * product concepts only; it never accepts a raw path, query string, or URL.
 */
export const ANALYTICS_PAGE_KEYS = [
  "landing",
  "home",
  "storage",
  "share",
  "shared_with_me",
  "recovery_access",
  "docs",
  "docs_how_it_works",
  "docs_how_to_use",
  "docs_keys_and_recovery",
  "docs_secure_sharing",
  "docs_privacy_model",
  "docs_security_model",
  "docs_if_zerodrive_disappears",
  "docs_self_hosting",
  "privacy",
  "terms",
] as const;

export type AnalyticsPageKey = (typeof ANALYTICS_PAGE_KEYS)[number];

export interface AnalyticsTotals {
  pageViews: number;
  logins: number;
  newUsers: number;
  limitedScopeLogins: number;
  filesAdded: number;
  shares: number;
  downloads: number;
  invitations: number;
  keySetups: number;
  keyRotations: number;
  sharesFinalized: number;
  sharesRevoked: number;
}

export interface AnalyticsSummary {
  enabled: true;
  rangeDays: number;
  totalEvents: number;
  totals: AnalyticsTotals;
  categories: {
    navigation: number;
    auth: number;
    files: number;
    sharing: number;
    keys: number;
  };
}

export interface AnalyticsDailyStat {
  date: string;
  pageViews: number;
  logins: number;
  newUsers: number;
  limitedScopeLogins: number;
  filesAdded: number;
  shares: number;
  downloads: number;
  invitations: number;
  keySetups: number;
  keyRotations: number;
  sharesFinalized: number;
  sharesRevoked: number;
}

export interface AnalyticsMonthlyStat {
  month: string;
  pageViews: number;
  totalEvents: number;
}

export interface AnalyticsDimensionBucket {
  metric:
    | "file_added_to_drive"
    | "file_shared"
    | "invitation_sent"
    | "page_view";
  dimension:
    | "source"
    | "size_bucket"
    | "file_category"
    | "has_expiration"
    | "has_custom_message"
    | "page";
  bucket: string;
  count: number | null;
  suppressed: boolean;
}
