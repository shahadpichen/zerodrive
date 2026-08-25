/**
 * Privacy-safe, first-party analytics.
 *
 * Analytics rows are daily or monthly aggregate counters only. Never add a
 * user, request, session, device, IP, file, share, or other identifying column
 * to these tables. Raw events are intentionally not retained.
 */
import type {
  AnalyticsDailyStat,
  AnalyticsDimensionBucket,
  AnalyticsMonthlyStat,
  AnalyticsSummary,
} from "@zerodrive/shared-types";
import { ANALYTICS_PAGE_KEYS } from "@zerodrive/shared-types";
import { isAnalyticsEnabled } from "../config/analytics";
import { query, transaction } from "../config/database";
import logger from "../utils/logger";

export enum AnalyticsEvent {
  USER_LOGIN = "user_login",
  USER_LOGIN_NEW = "user_login_new",
  USER_LOGIN_EXISTING = "user_login_existing",
  USER_LOGIN_LIMITED_SCOPE = "user_login_limited_scope",
  FILE_ADDED_TO_DRIVE = "file_added_to_drive",
  FILE_SHARED = "file_shared",
  INVITATION_SENT = "invitation_sent",
  SHARED_FILE_ACCESSED = "shared_file_accessed",
  KEY_SETUP_COMPLETED = "key_setup_completed",
  KEY_ROTATED = "key_rotated",
  SHARE_FINALIZED = "share_finalized",
  SHARE_REVOKED = "share_revoked",
  PAGE_VIEW = "page_view",
}

export enum AnalyticsCategory {
  AUTH = "auth",
  FILES = "files",
  SHARING = "sharing",
  KEYS = "keys",
  NAVIGATION = "navigation",
}

type DimensionName = AnalyticsDimensionBucket["dimension"];
type DimensionInput = Record<string, unknown>;

interface EventContract {
  column: string;
  category: AnalyticsCategory;
  dimensions: Partial<Record<string, DimensionName>>;
}

const EVENT_CONTRACTS: Record<AnalyticsEvent, EventContract> = {
  [AnalyticsEvent.USER_LOGIN]: {
    column: "total_logins",
    category: AnalyticsCategory.AUTH,
    dimensions: {},
  },
  [AnalyticsEvent.USER_LOGIN_NEW]: {
    column: "total_new_users",
    category: AnalyticsCategory.AUTH,
    dimensions: {},
  },
  [AnalyticsEvent.USER_LOGIN_EXISTING]: {
    column: "total_logins",
    category: AnalyticsCategory.AUTH,
    dimensions: {},
  },
  [AnalyticsEvent.USER_LOGIN_LIMITED_SCOPE]: {
    column: "total_limited_scope_logins",
    category: AnalyticsCategory.AUTH,
    dimensions: {},
  },
  [AnalyticsEvent.FILE_ADDED_TO_DRIVE]: {
    column: "total_files_added_to_drive",
    category: AnalyticsCategory.FILES,
    dimensions: {
      source: "source",
      size_bucket: "size_bucket",
      file_category: "file_category",
    },
  },
  [AnalyticsEvent.FILE_SHARED]: {
    column: "total_shares",
    category: AnalyticsCategory.SHARING,
    dimensions: {
      file_size_bucket: "size_bucket",
      has_expiration: "has_expiration",
    },
  },
  [AnalyticsEvent.INVITATION_SENT]: {
    column: "total_invitations",
    category: AnalyticsCategory.SHARING,
    dimensions: { has_custom_message: "has_custom_message" },
  },
  [AnalyticsEvent.SHARED_FILE_ACCESSED]: {
    column: "total_downloads",
    category: AnalyticsCategory.SHARING,
    dimensions: {},
  },
  [AnalyticsEvent.KEY_SETUP_COMPLETED]: {
    column: "total_key_setups",
    category: AnalyticsCategory.KEYS,
    dimensions: {},
  },
  [AnalyticsEvent.KEY_ROTATED]: {
    column: "total_key_rotations",
    category: AnalyticsCategory.KEYS,
    dimensions: {},
  },
  [AnalyticsEvent.SHARE_FINALIZED]: {
    column: "total_shares_finalized",
    category: AnalyticsCategory.SHARING,
    dimensions: {},
  },
  [AnalyticsEvent.SHARE_REVOKED]: {
    column: "total_shares_revoked",
    category: AnalyticsCategory.SHARING,
    dimensions: {},
  },
  [AnalyticsEvent.PAGE_VIEW]: {
    column: "total_page_views",
    category: AnalyticsCategory.NAVIGATION,
    dimensions: { page: "page" },
  },
};

const SAFE_BUCKET = /^[a-zA-Z0-9<>+_.-]{1,32}$/;
const ANALYTICS_PAGE_KEY_SET = new Set<string>(ANALYTICS_PAGE_KEYS);
const LOW_COUNT_THRESHOLD = 5;

function getContract(eventType: AnalyticsEvent | string): EventContract | null {
  return EVENT_CONTRACTS[eventType as AnalyticsEvent] || null;
}

function validateDimensions(
  contract: EventContract,
  metadata: DimensionInput | undefined,
): Array<{ dimension: DimensionName; bucket: string }> | null {
  const pageViewContract = EVENT_CONTRACTS[AnalyticsEvent.PAGE_VIEW];
  if (!metadata) return contract === pageViewContract ? null : [];

  const suppliedKeys = Object.keys(metadata);
  if (suppliedKeys.some((key) => !contract.dimensions[key])) return null;
  if (
    contract === pageViewContract &&
    (suppliedKeys.length !== 1 || suppliedKeys[0] !== "page")
  ) {
    return null;
  }

  const dimensions: Array<{ dimension: DimensionName; bucket: string }> = [];
  for (const key of suppliedKeys) {
    const value = metadata[key];
    const bucket = typeof value === "boolean" ? String(value) : value;
    if (typeof bucket !== "string" || !SAFE_BUCKET.test(bucket)) return null;
    if (
      contract === pageViewContract &&
      !ANALYTICS_PAGE_KEY_SET.has(bucket)
    ) {
      return null;
    }
    dimensions.push({ dimension: contract.dimensions[key]!, bucket });
  }
  return dimensions;
}

export async function trackEvent(
  eventType: AnalyticsEvent | string,
  category: AnalyticsCategory,
  metadata?: DimensionInput,
): Promise<void> {
  if (!isAnalyticsEnabled()) return;

  const contract = getContract(eventType);
  if (!contract || contract.category !== category) {
    logger.warn("[Analytics] Rejected event outside the analytics contract", {
      event: eventType,
    });
    return;
  }

  const dimensions = validateDimensions(contract, metadata);
  if (!dimensions) {
    logger.warn("[Analytics] Rejected non-contract metadata", {
      event: eventType,
    });
    return;
  }

  try {
    await query(`
      INSERT INTO analytics_daily_summary
        (deployment_id, date, ${contract.column})
      VALUES (zerodrive_default_deployment_id(), CURRENT_DATE, 1)
      ON CONFLICT (deployment_id, date)
      DO UPDATE SET ${contract.column} = analytics_daily_summary.${contract.column} + 1
    `);

    for (const { dimension, bucket } of dimensions) {
      await query(
        `INSERT INTO analytics_daily_dimensions
          (deployment_id, date, metric, dimension, bucket, count)
         VALUES (zerodrive_default_deployment_id(), CURRENT_DATE, $1, $2, $3, 1)
         ON CONFLICT (deployment_id, date, metric, dimension, bucket)
         DO UPDATE SET count = analytics_daily_dimensions.count + 1`,
        [eventType, dimension, bucket],
      );
    }

    logger.debug("[Analytics] Aggregate counter incremented", {
      event: eventType,
    });
  } catch (error) {
    logger.error("[Analytics] Failed to increment aggregate counter", {
      event: eventType,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function getFileSizeBucket(sizeBytes: number): string {
  const MB = 1024 * 1024;
  if (sizeBytes < MB) return "<1MB";
  if (sizeBytes < 10 * MB) return "1-10MB";
  if (sizeBytes < 50 * MB) return "10-50MB";
  if (sizeBytes < 100 * MB) return "50-100MB";
  return ">100MB";
}

export function getFileTypeCategory(mimeType: string): string {
  if (!mimeType) return "unknown";
  if (
    [
      "application/zip",
      "application/gzip",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
    ].includes(mimeType)
  ) {
    return "archive";
  }
  const type = mimeType.split("/")[0];
  if (["image", "video", "audio", "text"].includes(type)) return type;
  if (type === "application") return "document";
  return "other";
}

function asNumber(value: unknown): number {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

export async function getAnalyticsSummary(
  startDate: Date,
  endDate: Date,
): Promise<AnalyticsSummary> {
  const result = await query(
    `SELECT
       SUM(total_logins) AS existing_logins,
       SUM(total_new_users) AS new_users,
       SUM(total_limited_scope_logins) AS limited_scope_logins,
       SUM(total_downloads) AS downloads,
       SUM(total_files_added_to_drive) AS files_added,
       SUM(total_shares) AS shares,
       SUM(total_invitations) AS invitations,
       SUM(total_key_setups) AS key_setups,
       SUM(total_key_rotations) AS key_rotations,
       SUM(total_shares_finalized) AS shares_finalized,
       SUM(total_shares_revoked) AS shares_revoked,
       SUM(total_page_views) AS page_views
     FROM analytics_daily_summary
     WHERE deployment_id = zerodrive_default_deployment_id()
       AND date BETWEEN $1 AND $2`,
    [startDate, endDate],
  );

  const row = result.rows[0] || {};
  const newUsers = asNumber(row.new_users);
  const limitedScopeLogins = asNumber(row.limited_scope_logins);
  const logins = asNumber(row.existing_logins) + newUsers + limitedScopeLogins;
  const filesAdded = asNumber(row.files_added);
  const shares = asNumber(row.shares);
  const downloads = asNumber(row.downloads);
  const invitations = asNumber(row.invitations);
  const keySetups = asNumber(row.key_setups);
  const keyRotations = asNumber(row.key_rotations);
  const sharesFinalized = asNumber(row.shares_finalized);
  const sharesRevoked = asNumber(row.shares_revoked);
  const pageViews = asNumber(row.page_views);
  const auth = logins;
  const files = filesAdded;
  const sharing =
    shares + downloads + invitations + sharesFinalized + sharesRevoked;
  const keys = keySetups + keyRotations;
  const rangeDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1,
  );

  return {
    enabled: true,
    rangeDays,
    totalEvents: pageViews + auth + files + sharing + keys,
    totals: {
      pageViews,
      logins,
      newUsers,
      limitedScopeLogins,
      filesAdded,
      shares,
      downloads,
      invitations,
      keySetups,
      keyRotations,
      sharesFinalized,
      sharesRevoked,
    },
    categories: { navigation: pageViews, auth, files, sharing, keys },
  };
}

export async function getDailyStats(
  startDate: Date,
  endDate: Date,
): Promise<AnalyticsDailyStat[]> {
  const result = await query(
    `SELECT
       date,
       total_logins AS existing_logins,
       total_new_users AS new_users,
       total_limited_scope_logins AS limited_scope_logins,
       total_files_added_to_drive AS files_added,
       total_shares AS shares,
       total_downloads AS downloads,
       total_invitations AS invitations,
       total_key_setups AS key_setups,
       total_key_rotations AS key_rotations,
       total_shares_finalized AS shares_finalized,
       total_shares_revoked AS shares_revoked,
       total_page_views AS page_views
     FROM analytics_daily_summary
     WHERE deployment_id = zerodrive_default_deployment_id()
       AND date BETWEEN $1 AND $2
     ORDER BY date ASC`,
    [startDate, endDate],
  );

  return result.rows.map((row) => {
    const newUsers = asNumber(row.new_users);
    const limitedScopeLogins = asNumber(row.limited_scope_logins);
    return {
      date:
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date).slice(0, 10),
      pageViews: asNumber(row.page_views),
      logins: asNumber(row.existing_logins) + newUsers + limitedScopeLogins,
      newUsers,
      limitedScopeLogins,
      filesAdded: asNumber(row.files_added),
      shares: asNumber(row.shares),
      downloads: asNumber(row.downloads),
      invitations: asNumber(row.invitations),
      keySetups: asNumber(row.key_setups),
      keyRotations: asNumber(row.key_rotations),
      sharesFinalized: asNumber(row.shares_finalized),
      sharesRevoked: asNumber(row.shares_revoked),
    };
  });
}

export async function getDimensionStats(
  startDate: Date,
  endDate: Date,
): Promise<AnalyticsDimensionBucket[]> {
  const result = await query(
    `SELECT metric, dimension, bucket, SUM(count)::integer AS count
     FROM analytics_daily_dimensions
     WHERE deployment_id = zerodrive_default_deployment_id()
       AND date BETWEEN $1 AND $2
     GROUP BY metric, dimension, bucket
     ORDER BY metric, dimension, count DESC, bucket ASC`,
    [startDate, endDate],
  );

  return result.rows.map((row) => {
    const count = asNumber(row.count);
    const suppressed = count < LOW_COUNT_THRESHOLD;
    return {
      metric: row.metric,
      dimension: row.dimension,
      bucket: row.bucket,
      count: suppressed ? null : count,
      suppressed,
    };
  });
}

export async function getMonthlyStats(
  months: number = 120,
): Promise<AnalyticsMonthlyStat[]> {
  const result = await query(
    `SELECT
       month,
       total_page_views AS page_views,
       (
         total_page_views
         + total_logins
         + total_new_users
         + total_limited_scope_logins
         + total_downloads
         + total_files_added_to_drive
         + total_shares
         + total_invitations
         + total_key_setups
         + total_key_rotations
         + total_shares_finalized
         + total_shares_revoked
       ) AS total_events
     FROM analytics_monthly_summary
     WHERE deployment_id = zerodrive_default_deployment_id()
       AND month >= date_trunc('month', CURRENT_DATE) - (($1::integer - 1) * INTERVAL '1 month')
     ORDER BY month ASC`,
    [months],
  );

  return result.rows.map((row) => ({
    month:
      row.month instanceof Date
        ? row.month.toISOString().slice(0, 10)
        : String(row.month).slice(0, 10),
    pageViews: asNumber(row.page_views),
    totalEvents: asNumber(row.total_events),
  }));
}

export async function getMonthlyDimensionStats(
  months: number = 120,
): Promise<AnalyticsDimensionBucket[]> {
  const result = await query(
    `SELECT metric, dimension, bucket, SUM(count)::bigint AS count
     FROM analytics_monthly_dimensions
     WHERE deployment_id = zerodrive_default_deployment_id()
       AND month >= date_trunc('month', CURRENT_DATE) - (($1::integer - 1) * INTERVAL '1 month')
     GROUP BY metric, dimension, bucket
     ORDER BY metric, dimension, count DESC, bucket ASC`,
    [months],
  );

  return result.rows.map((row) => {
    const count = asNumber(row.count);
    const suppressed = count < LOW_COUNT_THRESHOLD;
    return {
      metric: row.metric,
      dimension: row.dimension,
      bucket: row.bucket,
      count: suppressed ? null : count,
      suppressed,
    };
  });
}

export async function cleanupAnalyticsRetention(): Promise<void> {
  if (!isAnalyticsEnabled()) return;

  try {
    await transaction(async (client) => {
      // Serialize rollups across API replicas. Rows are deleted only after the
      // corresponding monthly aggregates have been written in this transaction.
      await client.query("SELECT pg_advisory_xact_lock($1)", [907031215]);

      // Analytics writes use INSERT ... ON CONFLICT UPDATE. Block those writes
      // while old rows are copied and deleted so an increment cannot land
      // between the rollup SELECT and DELETE and disappear from both windows.
      await client.query(`
        LOCK TABLE analytics_daily_summary, analytics_daily_dimensions
        IN SHARE ROW EXCLUSIVE MODE
      `);

      await client.query(`
        INSERT INTO analytics_monthly_summary (
          deployment_id,
          month,
          total_logins,
          total_new_users,
          total_limited_scope_logins,
          total_downloads,
          total_files_added_to_drive,
          total_shares,
          total_invitations,
          total_key_setups,
          total_key_rotations,
          total_shares_finalized,
          total_shares_revoked,
          total_page_views
        )
        SELECT
          deployment_id,
          date_trunc('month', date)::date,
          SUM(total_logins),
          SUM(total_new_users),
          SUM(total_limited_scope_logins),
          SUM(total_downloads),
          SUM(total_files_added_to_drive),
          SUM(total_shares),
          SUM(total_invitations),
          SUM(total_key_setups),
          SUM(total_key_rotations),
          SUM(total_shares_finalized),
          SUM(total_shares_revoked),
          SUM(total_page_views)
        FROM analytics_daily_summary
        WHERE deployment_id = zerodrive_default_deployment_id()
          AND date < CURRENT_DATE - 400
        GROUP BY deployment_id, date_trunc('month', date)::date
        ON CONFLICT (deployment_id, month) DO UPDATE SET
          total_logins = analytics_monthly_summary.total_logins + EXCLUDED.total_logins,
          total_new_users = analytics_monthly_summary.total_new_users + EXCLUDED.total_new_users,
          total_limited_scope_logins = analytics_monthly_summary.total_limited_scope_logins + EXCLUDED.total_limited_scope_logins,
          total_downloads = analytics_monthly_summary.total_downloads + EXCLUDED.total_downloads,
          total_files_added_to_drive = analytics_monthly_summary.total_files_added_to_drive + EXCLUDED.total_files_added_to_drive,
          total_shares = analytics_monthly_summary.total_shares + EXCLUDED.total_shares,
          total_invitations = analytics_monthly_summary.total_invitations + EXCLUDED.total_invitations,
          total_key_setups = analytics_monthly_summary.total_key_setups + EXCLUDED.total_key_setups,
          total_key_rotations = analytics_monthly_summary.total_key_rotations + EXCLUDED.total_key_rotations,
          total_shares_finalized = analytics_monthly_summary.total_shares_finalized + EXCLUDED.total_shares_finalized,
          total_shares_revoked = analytics_monthly_summary.total_shares_revoked + EXCLUDED.total_shares_revoked,
          total_page_views = analytics_monthly_summary.total_page_views + EXCLUDED.total_page_views,
          updated_at = CURRENT_TIMESTAMP
      `);

      await client.query(`
        INSERT INTO analytics_monthly_dimensions (
          deployment_id, month, metric, dimension, bucket, count
        )
        SELECT
          deployment_id,
          date_trunc('month', date)::date,
          metric,
          dimension,
          bucket,
          SUM(count)
        FROM analytics_daily_dimensions
        WHERE deployment_id = zerodrive_default_deployment_id()
          AND date < CURRENT_DATE - 400
        GROUP BY
          deployment_id,
          date_trunc('month', date)::date,
          metric,
          dimension,
          bucket
        ON CONFLICT (deployment_id, month, metric, dimension, bucket)
        DO UPDATE SET
          count = analytics_monthly_dimensions.count + EXCLUDED.count,
          updated_at = CURRENT_TIMESTAMP
      `);

      await client.query(`
        DELETE FROM analytics_daily_dimensions
        WHERE deployment_id = zerodrive_default_deployment_id()
          AND date < CURRENT_DATE - 400
      `);
      await client.query(`
        DELETE FROM analytics_daily_summary
        WHERE deployment_id = zerodrive_default_deployment_id()
          AND date < CURRENT_DATE - 400
      `);
    });
    logger.info("[Analytics] Daily counters rolled into monthly history");
  } catch (error) {
    logger.error("[Analytics] Retention cleanup failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
