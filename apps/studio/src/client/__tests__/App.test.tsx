import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

describe("ZeroDrive Studio shell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const path = String(input);
        const body = path.endsWith("/api/session")
          ? { profile: "local", readOnly: false, csrfToken: "csrf" }
          : path.endsWith("/api/overview")
            ? {
                profile: "local",
                database: "zerodrive",
                user: "zerodrive_app",
                version: "PostgreSQL 15",
                latencyMs: 2,
                readOnly: false,
                tableCount: 4,
                viewCount: 1,
                migrationCount: 9,
                latestMigration: "009.sql",
              }
            : [];
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );
  });

  it("shows connection status and the ZeroDrive overview", async () => {
    render(<App />);
    expect(
      await screen.findByText("Your database, without the guesswork."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ZeroDrive Studio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Studio navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL connected")).toBeInTheDocument();
    expect(screen.getByText("zerodrive_app")).toBeInTheDocument();
  });
});
