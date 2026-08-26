import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DocsDetail from "../../pages/docs-detail";

jest.mock("../../components/landing-page/header", () => () => (
  <header>ZeroDrive header</header>
));
jest.mock("../../components/landing-page/footer", () => () => (
  <footer>ZeroDrive footer</footer>
));

describe("documentation guide", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          "---\ntitle: How ZeroDrive works\n---\n\n## The simple mental model\n\nReadable explanation.\n\n## Personal files\n\nEncrypted before upload.\n\n## Shared files\n\nRecipient encrypted.\n\n## Share lifecycle\n\nPending, active, and deleted.",
        ),
    });
  });

  it("renders category navigation, article anchors, and adjacent guides", async () => {
    render(
      <MemoryRouter initialEntries={["/docs/how-it-works"]}>
        <Routes>
          <Route path="/docs/:slug" element={<DocsDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "How ZeroDrive works", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("navigation", { name: "Documentation" }).length,
    ).toBeGreaterThan(0);

    const heading = await screen.findByRole("heading", {
      name: "The simple mental model",
    });
    expect(heading).toHaveAttribute("id", "the-simple-mental-model");
    expect(screen.getByText("Readable explanation.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "More documentation" }))
        .getByRole("link", { name: /quick start/i }),
    ).toHaveAttribute("href", "/docs/how-to-use");
  });

  it("shows a calm failure state instead of an internal fetch error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("private server response"),
    );

    render(
      <MemoryRouter initialEntries={["/docs/how-it-works"]}>
        <Routes>
          <Route path="/docs/:slug" element={<DocsDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/documentation page could not be loaded/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/private server response/i)).not.toBeInTheDocument();
    });
  });

  it("opens local documentation search with the standard keyboard shortcut", async () => {
    render(
      <MemoryRouter initialEntries={["/docs/how-it-works"]}>
        <Routes>
          <Route path="/docs/:slug" element={<DocsDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(
      await screen.findByRole("dialog", { name: "Search documentation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Search documentation" }),
    ).toHaveFocus();
    expect(screen.getByText(/search runs locally/i)).toBeInTheDocument();
  });

  it("opens local documentation search from the docs shell", async () => {
    render(
      <MemoryRouter initialEntries={["/docs/how-it-works"]}>
        <Routes>
          <Route path="/docs/:slug" element={<DocsDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /search docs/i })[0],
    );

    expect(
      await screen.findByRole("dialog", { name: "Search documentation" }),
    ).toBeInTheDocument();
  });
});
