import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SeoHead } from "../../components/seo-head";

// Metadata lives in document.head rather than the rendered application tree.
/* eslint-disable testing-library/no-node-access */

function headContent(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute("content") || null;
}

describe("client-side SEO metadata", () => {
  afterEach(() => {
    document.head
      .querySelectorAll('[data-zerodrive-seo="true"]')
      .forEach((element) => element.remove());
  });

  it("updates public route metadata after SPA navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/docs/security-model"]}>
        <SeoHead />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.title).toBe("Security model and limitations — ZeroDrive Docs");
    });
    expect(headContent('meta[name="robots"]')).toBe("index, follow");
    expect(headContent('meta[property="og:site_name"]')).toBe("ZeroDrive");
    expect(headContent('meta[name="twitter:card"]')).toBe(
      "summary_large_image",
    );
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href,
    ).toBe("https://zerodrive.xyz/docs/security-model");
  });

  it("removes canonical URLs and applies noindex on private routes", async () => {
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://zerodrive.xyz/";
    document.head.appendChild(canonical);

    render(
      <MemoryRouter initialEntries={["/storage"]}>
        <SeoHead />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(headContent('meta[name="robots"]')).toBe(
        "noindex, nofollow, noarchive",
      );
    });
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
