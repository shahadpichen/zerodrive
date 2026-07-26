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

export interface AnalyticsTotals {
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
    auth: number;
    files: number;
    sharing: number;
    keys: number;
  };
}

export interface AnalyticsDailyStat {
  date: string;
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

export interface AnalyticsDimensionBucket {
  metric: "file_added_to_drive" | "file_shared" | "invitation_sent";
  dimension:
    | "source"
    | "size_bucket"
    | "file_category"
    | "has_expiration"
    | "has_custom_message";
  bucket: string;
  count: number | null;
  suppressed: boolean;
}
