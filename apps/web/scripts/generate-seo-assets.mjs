import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(scriptDirectory, "../public");
const docsDirectory = path.join(publicDirectory, "docs");
const socialDirectory = path.join(publicDirectory, "social");
const docsSocialDirectory = path.join(socialDirectory, "docs");
const sourceLogo = path.join(publicDirectory, "logo192.png");
const siteOrigin = (
  process.env.REACT_APP_SITE_ORIGIN || "https://zerodrive.xyz"
).replace(/\/+$/, "");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title, maximum = 29) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximum && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function createSocialCard({ title, eyebrow, output }) {
  const lines = wrapTitle(title);
  const titleMarkup = lines
    .map(
      (line, index) =>
        `<text x="96" y="${262 + index * 72}" font-size="58" font-weight="600">${escapeXml(line)}</text>`,
    )
    .join("");
  const svg = Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#fffcf4"/>
      <rect x="44" y="44" width="1112" height="542" fill="none" stroke="#ada9a0" stroke-width="2"/>
      <text x="96" y="128" fill="#6f707c" font-family="monospace" font-size="22" letter-spacing="5">${escapeXml(eyebrow.toUpperCase())}</text>
      <g fill="#11100f" font-family="monospace">${titleMarkup}</g>
      <text x="96" y="530" fill="#242b61" font-family="monospace" font-size="25" font-weight="600">zerodrive.xyz</text>
      <line x1="96" y1="552" x2="1104" y2="552" stroke="#ada9a0" stroke-width="2"/>
    </svg>
  `);
  const logo = await sharp(sourceLogo).resize(88, 88).png().toBuffer();
  await sharp(svg)
    .composite([{ input: logo, left: 1014, top: 88 }])
    .png()
    .toFile(output);
}

function readFrontmatter(source) {
  const end = source.indexOf("\n---\n", 4);
  const values = {};
  for (const line of source.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

function stripFrontmatter(source) {
  const end = source.indexOf("\n---\n", 4);
  return end === -1 ? source : source.slice(end + 5).trim();
}

function escapeXmlText(value) {
  return escapeXml(value).replace(/\r?\n/g, " ");
}

async function generateDiscoveryResources(docs) {
  const staticPages = [
    {
      path: "/",
      title: "ZeroDrive",
      description: "Browser-encrypted file storage and private sharing on Google Drive.",
    },
    {
      path: "/docs",
      title: "ZeroDrive documentation",
      description: "Setup, storage, sharing, recovery, privacy, and security guides.",
    },
    {
      path: "/privacy",
      title: "Privacy Policy",
      description: "How ZeroDrive handles Google access and encrypted application data.",
    },
    {
      path: "/terms",
      title: "Terms of Service",
      description: "Terms for using ZeroDrive with your own Google Drive.",
    },
  ];

  const sitemapEntries = [
    ...staticPages.map(
      (page) => `  <url><loc>${siteOrigin}${page.path}</loc></url>`,
    ),
    ...docs.map(
      (doc) =>
        `  <url><loc>${siteOrigin}/docs/${doc.slug}</loc><lastmod>${escapeXmlText(doc.updated)}</lastmod></url>`,
    ),
  ];
  await fs.writeFile(
    path.join(publicDirectory, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join("\n")}\n</urlset>\n`,
  );

  const llmsLinks = [
    "# ZeroDrive",
    "",
    "> ZeroDrive adds browser-based encryption on top of Google Drive. Files are encrypted before upload, recovery access stays with the user, and private sharing is coordinated without storing sender identity in share records.",
    "",
    "## Public pages",
    ...staticPages.map(
      (page) => `- [${page.title}](${siteOrigin}${page.path}): ${page.description}`,
    ),
    "",
    "## Documentation",
    ...docs.map(
      (doc) =>
        `- [${doc.title}](${siteOrigin}/docs/${doc.slug}): ${doc.description}`,
    ),
    "",
    "## Source",
    `- [GitHub repository](https://github.com/zerodrivehq/zerodrive)`,
  ];
  await fs.writeFile(
    path.join(publicDirectory, "llms.txt"),
    `${llmsLinks.join("\n")}\n`,
  );

  const fullDocs = docs
    .map(
      (doc) =>
        `# ${doc.title}\n\nCanonical: ${siteOrigin}/docs/${doc.slug}\n\n${doc.description}\n\n${doc.body}`,
    )
    .join("\n\n---\n\n");
  await fs.writeFile(
    path.join(publicDirectory, "llms-full.txt"),
    `# ZeroDrive public documentation\n\n${fullDocs}\n`,
  );

  await fs.writeFile(
    path.join(publicDirectory, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /home\nDisallow: /storage\nDisallow: /share\nDisallow: /shared-with-me\nDisallow: /recovery-access\nDisallow: /key-management\nDisallow: /admin/\nDisallow: /oauth/\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`,
  );
}

async function generateAssets() {
  await fs.mkdir(socialDirectory, { recursive: true });
  await fs.rm(docsSocialDirectory, { recursive: true, force: true });
  await fs.mkdir(docsSocialDirectory, { recursive: true });

  await Promise.all([
    sharp(sourceLogo).resize(32, 32).png().toFile(path.join(publicDirectory, "favicon.png")),
    sharp(sourceLogo).resize(180, 180).png().toFile(path.join(publicDirectory, "apple-touch-icon.png")),
    sharp(sourceLogo).resize(192, 192).png().toFile(path.join(publicDirectory, "icon-192.png")),
    sharp(sourceLogo).resize(512, 512).png().toFile(path.join(publicDirectory, "icon-512.png")),
  ]);

  await Promise.all([
    createSocialCard({
      title: "Encrypted file storage on Google Drive",
      eyebrow: "ZeroDrive",
      output: path.join(socialDirectory, "zerodrive.png"),
    }),
    createSocialCard({
      title: "Storage, sharing, recovery, and security",
      eyebrow: "ZeroDrive documentation",
      output: path.join(socialDirectory, "docs.png"),
    }),
    createSocialCard({
      title: "Privacy Policy",
      eyebrow: "ZeroDrive",
      output: path.join(socialDirectory, "privacy.png"),
    }),
    createSocialCard({
      title: "Terms of Service",
      eyebrow: "ZeroDrive",
      output: path.join(socialDirectory, "terms.png"),
    }),
  ]);

  const docsFiles = (await fs.readdir(docsDirectory)).filter((file) =>
    file.endsWith(".md"),
  );
  const docs = [];
  await Promise.all(
    docsFiles.map(async (filename) => {
      const source = await fs.readFile(path.join(docsDirectory, filename), "utf8");
      const metadata = readFrontmatter(source);
      const slug = filename.replace(/\.md$/, "");
      docs.push({
        slug,
        title: metadata.title,
        description: metadata.description,
        updated: metadata.updated,
        body: stripFrontmatter(source),
      });
      await createSocialCard({
        title: metadata.title,
        eyebrow: "ZeroDrive documentation",
        output: path.join(docsSocialDirectory, `${slug}.png`),
      });
    }),
  );

  docs.sort((left, right) => left.title.localeCompare(right.title));
  await generateDiscoveryResources(docs);

  console.log(
    `Generated discovery resources, branded icons, and ${docsFiles.length + 4} social cards.`,
  );
}

generateAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
