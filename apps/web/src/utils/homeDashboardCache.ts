import type { FileMeta } from "./dexieDB";
import type { VaultSetupState } from "./vaultSetupState";

const HOME_DASHBOARD_CACHE_KEY = "zerodrive-home-dashboard-cache";
const HOME_DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;

export interface HomeDashboardCache {
  userEmail: string;
  counts: { files: number; folders: number };
  recent: FileMeta[];
  canReadAnalytics: boolean;
  vaultSetup: VaultSetupState | null;
}

interface SerializedHomeDashboardCache
  extends Omit<HomeDashboardCache, "recent"> {
  version: 1;
  savedAt: number;
  recent: Array<Omit<FileMeta, "uploadedDate"> & { uploadedDate: string }>;
}

export function readCachedHomeDashboardForUser(
  authenticatedUserEmail: string,
): HomeDashboardCache | null {
  try {
    const expectedUserEmail = authenticatedUserEmail.trim().toLowerCase();
    if (!expectedUserEmail) return null;

    const cached = sessionStorage.getItem(HOME_DASHBOARD_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as SerializedHomeDashboardCache;
    if (parsed.version !== 1) return null;
    if (parsed.userEmail.trim().toLowerCase() !== expectedUserEmail) {
      return null;
    }
    if (Date.now() - parsed.savedAt > HOME_DASHBOARD_CACHE_TTL_MS) {
      sessionStorage.removeItem(HOME_DASHBOARD_CACHE_KEY);
      return null;
    }

    return {
      userEmail: parsed.userEmail,
      counts: parsed.counts,
      recent: parsed.recent.map((file) => ({
        ...file,
        uploadedDate: new Date(file.uploadedDate),
      })),
      canReadAnalytics: parsed.canReadAnalytics,
      vaultSetup: parsed.vaultSetup,
    };
  } catch {
    return null;
  }
}

export function writeCachedHomeDashboard(cache: HomeDashboardCache): void {
  try {
    const serialized: SerializedHomeDashboardCache = {
      version: 1,
      savedAt: Date.now(),
      userEmail: cache.userEmail,
      counts: cache.counts,
      recent: cache.recent.map((file) => ({
        ...file,
        uploadedDate: new Date(file.uploadedDate).toISOString(),
      })),
      canReadAnalytics: cache.canReadAnalytics,
      vaultSetup: cache.vaultSetup,
    };

    sessionStorage.setItem(
      HOME_DASHBOARD_CACHE_KEY,
      JSON.stringify(serialized),
    );
  } catch {
    // Best-effort UI cache only.
  }
}

export function clearCachedHomeDashboard(): void {
  try {
    sessionStorage.removeItem(HOME_DASHBOARD_CACHE_KEY);
  } catch {
    // Best-effort UI cache only.
  }
}
