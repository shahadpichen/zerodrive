import React from "react";
import { useLocation } from "react-router-dom";
import {
  SITE_NAME,
  canonicalUrl,
  seoMetadataForPath,
  socialImageUrl,
} from "../lib/site-metadata";

function setMeta(selector: string, attributes: Record<string, string>): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.dataset.zerodriveSeo = "true";
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) =>
    element?.setAttribute(name, value),
  );
}

function setCanonical(href: string | null): void {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    element.dataset.zerodriveSeo = "true";
    document.head.appendChild(element);
  }
  element.href = href;
}

/** Keep metadata correct after client-side navigation. Initial HTML is set at build time. */
export function SeoHead() {
  const location = useLocation();

  React.useEffect(() => {
    const metadata = seoMetadataForPath(location.pathname);
    const isIndexable = metadata.robots === "index, follow";
    const pageUrl = isIndexable ? canonicalUrl(metadata.path) : null;
    const imageUrl = socialImageUrl(metadata);

    document.title = metadata.title;
    setCanonical(pageUrl);
    setMeta('meta[name="description"]', {
      name: "description",
      content: metadata.description,
    });
    setMeta('meta[name="robots"]', {
      name: "robots",
      content: metadata.robots,
    });
    setMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    setMeta('meta[property="og:title"]', {
      property: "og:title",
      content: metadata.title,
    });
    setMeta('meta[property="og:description"]', {
      property: "og:description",
      content: metadata.description,
    });
    setMeta('meta[property="og:type"]', {
      property: "og:type",
      content: metadata.type,
    });
    setMeta('meta[property="og:url"]', {
      property: "og:url",
      content: pageUrl || canonicalUrl("/"),
    });
    setMeta('meta[property="og:image"]', {
      property: "og:image",
      content: imageUrl,
    });
    setMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    setMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: metadata.title,
    });
    setMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: metadata.description,
    });
    setMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: imageUrl,
    });
  }, [location.pathname]);

  return null;
}
