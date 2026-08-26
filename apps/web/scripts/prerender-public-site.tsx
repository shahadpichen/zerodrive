import { createRequire } from "node:module";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import {
  PUBLIC_SEO_PAGES,
  SITE_NAME,
  canonicalUrl,
  seoMetadataForPath,
  socialImageUrl,
  type SeoMetadata,
} from "../src/lib/site-metadata";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildDirectory = path.resolve(scriptDirectory, "../build");

const runtimeRequire = createRequire(import.meta.url);
const runtimeExtensions = runtimeRequire.extensions;
for (const extension of [".png", ".jpg", ".jpeg", ".gif", ".webp"] as const) {
  runtimeExtensions[extension] = (module, filename) => {
    const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : `image/${extension.slice(1)}`;
    module.exports = `data:${mime};base64,${readFileSync(filename).toString("base64")}`;
  };
}
runtimeExtensions[".svg"] = (module, filename) => {
  module.exports = `data:image/svg+xml;base64,${readFileSync(filename).toString("base64")}`;
};

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function metadataMarkup(metadata: SeoMetadata): string {
  const indexable = metadata.robots === "index, follow";
  const pageUrl = indexable ? canonicalUrl(metadata.path) : canonicalUrl("/");
  const imageUrl = socialImageUrl(metadata);
  const canonical = indexable
    ? `<link rel="canonical" href="${escapeAttribute(pageUrl)}" data-zerodrive-seo="true" />`
    : "";
  return [
    `<title>${escapeAttribute(metadata.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(metadata.description)}" data-zerodrive-seo="true" />`,
    `<meta name="robots" content="${metadata.robots}" data-zerodrive-seo="true" />`,
    canonical,
    `<meta property="og:site_name" content="${SITE_NAME}" data-zerodrive-seo="true" />`,
    `<meta property="og:title" content="${escapeAttribute(metadata.title)}" data-zerodrive-seo="true" />`,
    `<meta property="og:description" content="${escapeAttribute(metadata.description)}" data-zerodrive-seo="true" />`,
    `<meta property="og:type" content="${metadata.type}" data-zerodrive-seo="true" />`,
    `<meta property="og:url" content="${escapeAttribute(pageUrl)}" data-zerodrive-seo="true" />`,
    `<meta property="og:image" content="${escapeAttribute(imageUrl)}" data-zerodrive-seo="true" />`,
    `<meta property="og:image:width" content="1200" data-zerodrive-seo="true" />`,
    `<meta property="og:image:height" content="630" data-zerodrive-seo="true" />`,
    `<meta name="twitter:card" content="summary_large_image" data-zerodrive-seo="true" />`,
    `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}" data-zerodrive-seo="true" />`,
    `<meta name="twitter:description" content="${escapeAttribute(metadata.description)}" data-zerodrive-seo="true" />`,
    `<meta name="twitter:image" content="${escapeAttribute(imageUrl)}" data-zerodrive-seo="true" />`,
  ]
    .filter(Boolean)
    .join("\n    ");
}

function removeTemplateMetadata(html: string): string {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>\s*/i, "\n")
    .replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, "\n")
    .replace(
      /\s*<meta(?=[^>]*(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)")[^>]*>\s*/gi,
      "\n",
    );
}

function composeHtml(
  template: string,
  metadata: SeoMetadata,
  markup: string,
): string {
  const cleanTemplate = removeTemplateMetadata(template);
  return cleanTemplate
    .replace("</head>", `    ${metadataMarkup(metadata)}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-prerendered-path="${escapeAttribute(metadata.path)}">${markup}</div>`,
    );
}

async function outputPathForRoute(routePath: string): Promise<string> {
  if (routePath === "/") return path.join(buildDirectory, "index.html");
  const directory = path.join(buildDirectory, routePath.replace(/^\//, ""));
  await fs.mkdir(directory, { recursive: true });
  return path.join(directory, "index.html");
}

async function prerender() {
  const template = await fs.readFile(path.join(buildDirectory, "index.html"), "utf8");
  const [{ PublicPrerenderRoutes }, { ThemeProvider }, { Toaster }] =
    await Promise.all([
      import("../src/components/public-prerender-routes"),
      import("../src/components/theme-provider"),
      import("../src/components/ui/sonner"),
    ]);

  const privateAppMetadata = seoMetadataForPath("/app");
  await fs.writeFile(
    path.join(buildDirectory, "app.html"),
    composeHtml(template, privateAppMetadata, ""),
  );

  for (const metadata of PUBLIC_SEO_PAGES) {
    const markup = renderToString(
      <React.StrictMode>
        <ThemeProvider defaultTheme="light">
          <StaticRouter location={metadata.path}>
            <PublicPrerenderRoutes />
          </StaticRouter>
          <Toaster />
        </ThemeProvider>
      </React.StrictMode>,
    );
    const outputPath = await outputPathForRoute(metadata.path);
    await fs.writeFile(outputPath, composeHtml(template, metadata, markup));
  }

  const notFoundMetadata = seoMetadataForPath("/404");
  const notFoundMarkup = renderToString(
    <ThemeProvider defaultTheme="light">
      <StaticRouter location="/404">
        <PublicPrerenderRoutes />
      </StaticRouter>
      <Toaster />
    </ThemeProvider>,
  );
  await fs.writeFile(
    path.join(buildDirectory, "404.html"),
    composeHtml(template, notFoundMetadata, notFoundMarkup),
  );

  console.log(`Pre-rendered ${PUBLIC_SEO_PAGES.length} public routes and a 404 page.`);
}

prerender().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
