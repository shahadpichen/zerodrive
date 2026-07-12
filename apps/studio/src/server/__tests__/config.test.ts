// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isLoopbackHostname, loadStudioConfig } from "../config";

describe("Studio configuration", () => {
  it("uses the local Docker database by default", () => {
    const config = loadStudioConfig({ NODE_ENV: "test" });
    expect(config.profile).toBe("local");
    expect(new URL(config.databaseUrl).port).toBe("5433");
    expect(config.host).toBe("127.0.0.1");
  });

  it("requires an explicit production URL", () => {
    expect(() => loadStudioConfig({ STUDIO_PROFILE: "production" })).toThrow(
      "STUDIO_DATABASE_URL is required",
    );
  });

  it("rejects production databases not reached through loopback", () => {
    expect(() =>
      loadStudioConfig({
        STUDIO_PROFILE: "production",
        STUDIO_DATABASE_URL:
          "postgres://reader:secret@database.example.com/zerodrive",
      }),
    ).toThrow("loopback SSH tunnel");
  });

  it("recognizes supported loopback names and addresses", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.99.10.2")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("0.0.0.0")).toBe(false);
  });
});
