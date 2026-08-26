import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getDocsPage } from "../../components/docs/docs-content";
import { DocsNavigation } from "../../components/docs/docs-navigation";

describe("DocsNavigation", () => {
  it("opens the current page category and collapses other categories", () => {
    const currentPage = getDocsPage("how-it-works");
    expect(currentPage).toBeDefined();

    render(
      <MemoryRouter>
        <DocsNavigation currentPage={currentPage} compact />
      </MemoryRouter>,
    );

    const gettingStarted = screen.getByRole("button", {
      name: "Getting started",
    });
    const storage = screen.getByRole("button", { name: "Storage" });

    expect(gettingStarted).toHaveAttribute("aria-expanded", "true");
    expect(storage).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("link", { name: "How ZeroDrive works" }),
    ).toBeVisible();
  });

  it("lets readers expand and collapse documentation categories", () => {
    render(
      <MemoryRouter>
        <DocsNavigation currentPage={getDocsPage("how-it-works")} compact />
      </MemoryRouter>,
    );

    const storage = screen.getByRole("button", { name: "Storage" });
    fireEvent.click(storage);

    expect(storage).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Use encrypted Storage" }),
    ).toBeVisible();

    fireEvent.click(storage);
    expect(storage).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Use encrypted Storage" }),
    ).toBeNull();
  });

  it("uses unique category panel ids for multiple navigation instances", () => {
    const currentPage = getDocsPage("how-it-works");

    render(
      <MemoryRouter>
        <DocsNavigation currentPage={currentPage} compact />
        <DocsNavigation currentPage={currentPage} compact />
      </MemoryRouter>,
    );

    const categoryButtons = screen.getAllByRole("button", {
      name: "Getting started",
    });
    const panelIds = categoryButtons.map((button) =>
      button.getAttribute("aria-controls"),
    );

    expect(panelIds[0]).toBeTruthy();
    expect(panelIds[1]).toBeTruthy();
    expect(panelIds[0]).not.toBe(panelIds[1]);
  });
});
