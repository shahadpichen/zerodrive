import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import {
  analyticsPageForPath,
  PageViewTracker,
} from "../../components/page-view-tracker";

describe("privacy-safe page view tracker", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it.each([
    ["/home", "home"],
    ["/storage", "storage"],
    ["/share", "share"],
    ["/shared-with-me", "shared_with_me"],
    ["/recovery-access", "recovery_access"],
    ["/docs", "docs"],
    ["/docs/how-it-works", "docs_how_it_works"],
    ["/docs/how-to-use", "docs_how_to_use"],
    ["/docs/keys-and-recovery", "docs_keys_and_recovery"],
    ["/docs/secure-sharing", "docs_secure_sharing"],
    ["/docs/privacy-model", "docs_privacy_model"],
    ["/docs/security-model", "docs_security_model"],
    [
      "/docs/if-zerodrive-disappears",
      "docs_if_zerodrive_disappears",
    ],
    ["/docs/self-hosting", "docs_self_hosting"],
    ["/privacy", "privacy"],
    ["/terms", "terms"],
  ])("maps %s to reviewed bucket %s", (path, page) => {
    expect(analyticsPageForPath(path)).toBe(page);
  });

  it.each([
    "/admin/analytics",
    "/oauth/callback",
    "/key-management",
    "/docs/not-a-real-doc",
    "/storage/private-file-id",
  ])("does not track unreviewed path %s", (path) => {
    expect(analyticsPageForPath(path)).toBeNull();
  });

  it("posts only the allowlisted bucket and no route metadata", async () => {
    render(
      <MemoryRouter initialEntries={["/docs/security-model?source=secret"]}>
        <PageViewTracker />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/analytics/page-view",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ page: "docs_security_model" }),
          credentials: "omit",
          keepalive: true,
        }),
      );
    });
  });

  it("does not block navigation when analytics delivery fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("analytics unavailable"),
    );

    function NavigateToDocs() {
      const navigate = useNavigate();
      React.useEffect(() => navigate("/docs/security-model"), [navigate]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <PageViewTracker />
        <Routes>
          <Route path="/home" element={<NavigateToDocs />} />
          <Route path="/docs/security-model" element={<p>Security doc</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Security doc")).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/analytics/page-view",
        expect.objectContaining({
          body: JSON.stringify({ page: "docs_security_model" }),
          credentials: "omit",
        }),
      );
    });
  });

  it("tracks each real SPA navigation with its own reviewed bucket", async () => {
    function NavigateToStorage() {
      const navigate = useNavigate();
      React.useEffect(() => navigate("/storage"), [navigate]);
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <PageViewTracker />
        <Routes>
          <Route path="/home" element={<NavigateToStorage />} />
          <Route path="/storage" element={<p>Storage</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/analytics/page-view",
        expect.objectContaining({
          body: JSON.stringify({ page: "storage" }),
          credentials: "omit",
        }),
      );
    });
  });

  it("counts a page again when the user returns through browser history", async () => {
    function NavigationControls() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate("/storage")}>
            Open storage
          </button>
          <button type="button" onClick={() => navigate(-1)}>
            Go back
          </button>
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <PageViewTracker />
        <NavigationControls />
      </MemoryRouter>,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Open storage" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

    const bodies = (global.fetch as jest.Mock).mock.calls.map(([, init]) =>
      JSON.parse(init.body),
    );
    expect(bodies).toEqual([
      { page: "home" },
      { page: "storage" },
      { page: "home" },
    ]);
  });
});
