import {
  docsCategories,
  docsPages,
  getAdjacentDocsPages,
  getPagesInCategory,
  searchDocs,
  slugifyDocsHeading,
  stripDocsFrontmatter,
} from "../../components/docs/docs-content";

describe("generated documentation catalog", () => {
  it("keeps every guide uniquely ordered inside a valid category", () => {
    const categoryIds = new Set(docsCategories.map((category) => category.id));
    const slugs = docsPages.map((page) => page.slug);
    const categoryOrders = docsPages.map(
      (page) => `${page.category}:${page.order}`,
    );

    expect(docsPages).toHaveLength(23);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(categoryOrders).size).toBe(categoryOrders.length);
    expect(
      docsPages.every((page) => categoryIds.has(page.category)),
    ).toBe(true);
    expect(docsPages.every((page) => page.sections.length > 0)).toBe(true);
  });

  it("generates category navigation and previous/next reading order", () => {
    expect(getPagesInCategory("sharing").map((page) => page.slug)).toEqual([
      "secure-sharing",
      "create-sharing-identity",
      "share-a-file",
      "shared-with-me-guide",
    ]);

    const current = docsPages.find((page) => page.slug === "share-a-file")!;
    const adjacent = getAdjacentDocsPages(current);
    expect(adjacent.previous?.slug).toBe("create-sharing-identity");
    expect(adjacent.next?.slug).toBe("shared-with-me-guide");
  });

  it("searches titles, descriptions, and guide content", () => {
    expect(searchDocs("Google permissions")[0]?.slug).toBe(
      "google-permissions",
    );
    expect(searchDocs("HEIC preview").map((page) => page.slug)).toContain(
      "previews-and-downloads",
    );
    expect(searchDocs("recipient sharing identity").map((page) => page.slug))
      .toContain("create-sharing-identity");
    expect(searchDocs("not-a-real-zerodrive-topic")).toEqual([]);
  });

  it("strips source frontmatter and creates stable heading anchors", () => {
    expect(
      stripDocsFrontmatter("---\ntitle: Example\n---\n\n## Start here"),
    ).toBe("## Start here");
    expect(slugifyDocsHeading("Google Drive’s `appDataFolder`")).toBe(
      "google-drives-appdatafolder",
    );
  });
});
