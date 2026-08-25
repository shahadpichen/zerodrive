import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { AnalyticsPageKey } from "@zerodrive/shared-types";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

const DOC_PAGE_KEYS: Readonly<Record<string, AnalyticsPageKey>> = {
  "how-it-works": "docs_how_it_works",
  "how-to-use": "docs_how_to_use",
  "keys-and-recovery": "docs_keys_and_recovery",
  "secure-sharing": "docs_secure_sharing",
  "privacy-model": "docs_privacy_model",
  "security-model": "docs_security_model",
  "if-zerodrive-disappears": "docs_if_zerodrive_disappears",
  "self-hosting": "docs_self_hosting",
};

const PRODUCT_PAGE_KEYS: Readonly<Record<string, AnalyticsPageKey>> = {
  "/home": "home",
  "/storage": "storage",
  "/share": "share",
  "/shared-with-me": "shared_with_me",
  "/recovery-access": "recovery_access",
  "/docs": "docs",
  "/privacy": "privacy",
  "/terms": "terms",
};

let lastTrackedNavigation: string | null = null;

async function countPageView(page: AnalyticsPageKey): Promise<void> {
  await fetch(`${API_BASE_URL}/analytics/page-view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page }),
    // This endpoint is deliberately public and aggregate-only. Omitting
    // credentials prevents the browser's login and CSRF cookies from being
    // attached to a page-attention request.
    credentials: "omit",
    keepalive: true,
  });
}

export function analyticsPageForPath(pathname: string): AnalyticsPageKey | null {
  const direct = PRODUCT_PAGE_KEYS[pathname];
  if (direct) return direct;
  const match = pathname.match(/^\/docs\/([^/]+)\/?$/);
  return match ? DOC_PAGE_KEYS[match[1]] || null : null;
}

/** Count reviewed product pages only. Raw paths never leave the browser. */
export function PageViewTracker({ page: fixedPage }: { page?: AnalyticsPageKey }) {
  const location = useLocation();

  useEffect(() => {
    const page = fixedPage || analyticsPageForPath(location.pathname);
    if (!page) return;

    // React StrictMode can mount effects twice in development. A navigation
    // key is unique for each real SPA visit while a reload resets this module.
    const navigationId = `${location.key}:${page}`;
    if (lastTrackedNavigation === navigationId) return;
    lastTrackedNavigation = navigationId;

    void countPageView(page).catch(() => undefined);
  }, [fixedPage, location.key, location.pathname]);

  return null;
}
