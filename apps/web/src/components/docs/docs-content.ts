import { docsManifest } from "../../generated/docs-manifest";

export interface DocsCategory {
  id: string;
  title: string;
  description: string;
}

export interface DocsSection {
  id: string;
  title: string;
  level: 2 | 3;
}

export interface DocsPage {
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
  updated: string;
  analyticsKey: string | null;
  sections: readonly DocsSection[];
  body: string;
  searchText: string;
}

export const docsCategories =
  docsManifest.categories as unknown as readonly DocsCategory[];
export const docsPages = docsManifest.pages as unknown as readonly DocsPage[];

export function getDocsPage(slug: string | undefined): DocsPage | undefined {
  return docsPages.find((page) => page.slug === slug);
}

export function getDocsCategory(
  categoryId: string,
): DocsCategory | undefined {
  return docsCategories.find((category) => category.id === categoryId);
}

export function getPagesInCategory(categoryId: string): DocsPage[] {
  return docsPages.filter((page) => page.category === categoryId);
}

export function getAdjacentDocsPages(page: DocsPage): {
  previous?: DocsPage;
  next?: DocsPage;
} {
  const index = docsPages.findIndex((candidate) => candidate.slug === page.slug);
  if (index === -1) return {};
  return {
    previous: index > 0 ? docsPages[index - 1] : undefined,
    next: index < docsPages.length - 1 ? docsPages[index + 1] : undefined,
  };
}

export function slugifyDocsHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function searchDocs(query: string): DocsPage[] {
  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return [];

  return docsPages
    .map((page) => {
      const title = page.title.toLowerCase();
      const description = page.description.toLowerCase();
      const body = page.searchText.toLowerCase();
      const matches = terms.every(
        (term) =>
          title.includes(term) ||
          description.includes(term) ||
          body.includes(term),
      );
      const score = terms.reduce(
        (total, term) =>
          total +
          (title.includes(term) ? 4 : 0) +
          (description.includes(term) ? 2 : 0) +
          (body.includes(term) ? 1 : 0),
        0,
      );
      return { page, matches, score };
    })
    .filter((result) => result.matches)
    .sort((left, right) => right.score - left.score)
    .map((result) => result.page);
}
