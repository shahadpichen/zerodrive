import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(appDirectory, "build");
const publicDirectory = path.join(appDirectory, "public");
const origin = (process.env.REACT_APP_SITE_ORIGIN || "https://zerodrive.xyz")
  .trim()
  .replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) throw new Error(`SEO validation failed: ${message}`);
}

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function frontmatter(source) {
  const end = source.indexOf("\n---\n", 4);
  const metadata = {};
  for (const line of source.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    metadata[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim();
  }
  return { metadata, body: source.slice(end + 5).trim() };
}

async function validateImage(relativePath, width, height) {
  const metadata = await sharp(path.join(publicDirectory, relativePath)).metadata();
  assert(
    metadata.width === width && metadata.height === height,
    `${relativePath} must be ${width}x${height}`,
  );
}

async function validate() {
  const docsDirectory = path.join(publicDirectory, "docs");
  const docs = [];
  for (const filename of await fs.readdir(docsDirectory)) {
    if (!filename.endsWith(".md")) continue;
    const source = await fs.readFile(path.join(docsDirectory, filename), "utf8");
    const { metadata, body } = frontmatter(source);
    docs.push({
      slug: filename.replace(/\.md$/, ""),
      ...metadata,
      body,
    });
  }

  const sitemap = await fs.readFile(
    path.join(publicDirectory, "sitemap.xml"),
    "utf8",
  );
  const privatePaths = [
    "/home",
    "/storage",
    "/share",
    "/shared-with-me",
    "/recovery-access",
    "/admin/analytics",
    "/oauth/callback",
  ];
  for (const privatePath of privatePaths) {
    assert(!sitemap.includes(`<loc>${origin}${privatePath}</loc>`), `${privatePath} is private`);
  }

  const titles = new Set();
  const descriptions = new Set();
  for (const doc of docs) {
    const route = `/docs/${doc.slug}`;
    assert(sitemap.includes(`<loc>${origin}${route}</loc>`), `${route} is missing from sitemap`);
    assert(sitemap.includes(`<lastmod>${doc.updated}</lastmod>`), `${route} has no lastmod`);

    const html = await fs.readFile(
      path.join(buildDirectory, "docs", doc.slug, "index.html"),
      "utf8",
    );
    const expectedTitle = `${doc.title} — ZeroDrive Docs`;
    assert(
      html.includes(`<title>${escapeAttribute(expectedTitle)}</title>`),
      `${route} title is wrong`,
    );
    assert(
      html.includes(`content="${escapeAttribute(doc.description)}"`),
      `${route} description is missing`,
    );
    assert(html.includes(`<link rel="canonical" href="${origin}${route}"`), `${route} canonical is missing`);
    assert(html.includes('itemType="https://schema.org/TechArticle"'), `${route} has no TechArticle data`);
    const firstHeading = doc.body
      .split("\n")
      .find((line) => line.startsWith("## "))
      ?.slice(3);
    assert(
      firstHeading && html.includes(`>${escapeAttribute(firstHeading)}</h2>`),
      `${route} body is not pre-rendered`,
    );
    assert(!titles.has(expectedTitle), `${route} title is duplicated`);
    assert(!descriptions.has(doc.description), `${route} description is duplicated`);
    titles.add(expectedTitle);
    descriptions.add(doc.description);
    await validateImage(`social/docs/${doc.slug}.png`, 1200, 630);
  }

  const appHtml = await fs.readFile(path.join(buildDirectory, "app.html"), "utf8");
  assert(appHtml.includes('content="noindex, nofollow, noarchive"'), "private SPA shell is indexable");
  assert(appHtml.includes('<div id="root" data-prerendered-path="/app"></div>'), "private SPA shell contains public content");

  const notFound = await fs.readFile(path.join(buildDirectory, "404.html"), "utf8");
  assert(notFound.includes("Page not found — ZeroDrive"), "custom 404 is missing");
  assert(notFound.includes('content="noindex, nofollow, noarchive"'), "404 is indexable");

  await Promise.all([
    validateImage("favicon.png", 32, 32),
    validateImage("apple-touch-icon.png", 180, 180),
    validateImage("icon-192.png", 192, 192),
    validateImage("icon-512.png", 512, 512),
    validateImage("social/zerodrive.png", 1200, 630),
    validateImage("social/docs.png", 1200, 630),
    validateImage("social/privacy.png", 1200, 630),
    validateImage("social/terms.png", 1200, 630),
  ]);

  const nginx = await fs.readFile(path.join(appDirectory, "nginx.conf"), "utf8");
  assert(nginx.includes("return 301 /docs/how-it-works"), "legacy docs redirect is missing");
  assert(nginx.includes("/docs/.+\\.md$"), "raw Markdown noindex rule is missing");
  assert(nginx.includes('"noindex, nofollow, noarchive"'), "private noindex header is missing");

  console.log(`Validated ${docs.length + 4} pre-rendered public routes and all discovery assets.`);
}

validate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
