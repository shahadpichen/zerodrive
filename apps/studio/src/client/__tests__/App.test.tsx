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

  it("opens the data explorer with the ZeroDrive header", async () => {
    render(<App />);
    expect(
      await screen.findByRole("region", { name: "Database explorer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ZeroDrive Studio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Studio navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL connected")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });
});
