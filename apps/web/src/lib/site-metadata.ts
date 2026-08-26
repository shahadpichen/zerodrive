import { docsPages } from "../components/docs/docs-content";

export const SITE_NAME = "ZeroDrive";
export const DEFAULT_SITE_ORIGIN = "https://zerodrive.xyz";

function normalizeSiteOrigin(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_SITE_ORIGIN;
  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const SITE_ORIGIN = normalizeSiteOrigin(
  process.env.REACT_APP_SITE_ORIGIN,
);

export interface SeoMetadata {
  path: string;
  title: string;
  description: string;
  robots: "index, follow" | "noindex, nofollow, noarchive";
  type: "website" | "article";
  imagePath: string;
  updated?: string;
}

const STATIC_PUBLIC_PAGES: readonly SeoMetadata[] = [
  {
    path: "/",
    title: "ZeroDrive — Encrypted File Storage on Google Drive",
    description:
      "ZeroDrive adds browser-based encryption on top of Google Drive. Protect files before upload, share encrypted copies, and keep recovery access under your control.",
    robots: "index, follow",
    type: "website",
    imagePath: "/social/zerodrive.png",
  },
  {
    path: "/docs",
    title: "ZeroDrive Documentation — Storage, Sharing & Recovery",
    description:
      "Learn how to set up ZeroDrive, encrypt files in Google Drive, share files privately, recover access, and understand the security model.",
    robots: "index, follow",
    type: "website",
    imagePath: "/social/docs.png",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — ZeroDrive",
    description:
      "Learn how ZeroDrive handles Google access, encrypted vault data, recovery information, sharing records, analytics, and local browser storage.",
    robots: "index, follow",
    type: "website",
    imagePath: "/social/privacy.png",
  },
  {
    path: "/terms",
    title: "Terms of Service — ZeroDrive",
    description:
      "Read the terms for using ZeroDrive as an open-source encryption layer on top of your own Google Drive.",
    robots: "index, follow",
    type: "website",
    imagePath: "/social/terms.png",
  },
];

const DOCS_PUBLIC_PAGES: readonly SeoMetadata[] = docsPages.map((page) => ({
  path: `/docs/${page.slug}`,
  title: `${page.title} — ZeroDrive Docs`,
  description: page.description,
  robots: "index, follow",
  type: "article",
  imagePath: `/social/docs/${page.slug}.png`,
  updated: page.updated,
}));

export const PUBLIC_SEO_PAGES: readonly SeoMetadata[] = [
  ...STATIC_PUBLIC_PAGES,
  ...DOCS_PUBLIC_PAGES,
];

const PUBLIC_SEO_BY_PATH = new Map(
  PUBLIC_SEO_PAGES.map((page) => [page.path, page]),
);

const PRIVATE_ROUTE_PATTERN =
  /^\/(?:home|storage|share|shared-with-me|recovery-access|key-management|admin(?:\/|$)|oauth(?:\/|$))/;

export function canonicalUrl(path: string): string {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}

export function seoMetadataForPath(pathname: string): SeoMetadata {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const publicPage = PUBLIC_SEO_BY_PATH.get(normalizedPath);
  if (publicPage) return publicPage;

  const isPrivate = PRIVATE_ROUTE_PATTERN.test(normalizedPath);
  return {
    path: normalizedPath,
    title: isPrivate ? "ZeroDrive" : "Page not found — ZeroDrive",
    description: isPrivate
      ? "ZeroDrive authenticated application."
      : "The requested ZeroDrive page could not be found.",
    robots: "noindex, nofollow, noarchive",
    type: "website",
    imagePath: "/social/zerodrive.png",
  };
}

export function socialImageUrl(metadata: SeoMetadata): string {
  return canonicalUrl(metadata.imagePath);
}
