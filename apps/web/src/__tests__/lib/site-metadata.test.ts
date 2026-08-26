import { docsPages } from "../../components/docs/docs-content";
import {
  PUBLIC_SEO_PAGES,
  canonicalUrl,
  seoMetadataForPath,
  socialImageUrl,
} from "../../lib/site-metadata";

describe("public SEO metadata", () => {
  it("defines one unique, indexable descriptor for every public page", () => {
    const paths = PUBLIC_SEO_PAGES.map((page) => page.path);
    const titles = PUBLIC_SEO_PAGES.map((page) => page.title);
    const descriptions = PUBLIC_SEO_PAGES.map((page) => page.description);

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(
      PUBLIC_SEO_PAGES.every((page) => page.robots === "index, follow"),
    ).toBe(true);
  });

  it("contains every generated documentation route", () => {
    const publicPaths = new Set(PUBLIC_SEO_PAGES.map((page) => page.path));
    for (const page of docsPages) {
      expect(publicPaths).toContain(`/docs/${page.slug}`);
      const metadata = seoMetadataForPath(`/docs/${page.slug}`);
      expect(metadata.title).toBe(`${page.title} — ZeroDrive Docs`);
      expect(metadata.description).toBe(page.description);
      expect(metadata.updated).toBe(page.updated);
    }
  });

  it.each([
    "/home",
    "/storage",
    "/share",
    "/shared-with-me",
    "/recovery-access",
    "/admin/analytics",
    "/oauth/callback",
  ])("marks private route %s as noindex", (path) => {
    expect(seoMetadataForPath(path).robots).toBe(
      "noindex, nofollow, noarchive",
    );
  });

  it("builds absolute canonical and social URLs from the production origin", () => {
    const metadata = seoMetadataForPath("/docs/how-it-works");
    expect(canonicalUrl(metadata.path)).toBe(
      "https://zerodrive.xyz/docs/how-it-works",
    );
    expect(socialImageUrl(metadata)).toBe(
      "https://zerodrive.xyz/social/docs/how-it-works.png",
    );
  });
});
