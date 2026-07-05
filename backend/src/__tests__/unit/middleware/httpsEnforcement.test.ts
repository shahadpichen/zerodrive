import {
  isLoopbackAddress,
  requiresHttps,
} from "../../../middleware/httpsEnforcement";

describe("HTTPS enforcement", () => {
  it("recognizes IPv4 and IPv6 loopback addresses", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.10.20.30")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("10.0.0.5")).toBe(false);
  });

  it("rejects insecure non-loopback production traffic", () => {
    expect(requiresHttps("production", false, "203.0.113.10")).toBe(true);
    expect(requiresHttps("production", false, "10.0.0.5")).toBe(true);
  });

  it("allows trusted HTTPS, loopback health checks, and development", () => {
    expect(requiresHttps("production", true, "10.0.0.5")).toBe(false);
    expect(requiresHttps("production", false, "127.0.0.1")).toBe(false);
    expect(requiresHttps("development", false, "203.0.113.10")).toBe(false);
  });
});
