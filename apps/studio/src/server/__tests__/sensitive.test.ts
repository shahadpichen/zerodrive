// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSensitiveColumn } from "../sensitive";

describe("sensitive Studio fields", () => {
  it("masks capabilities, encrypted envelopes, identifiers, and secret-like fields", () => {
    expect(isSensitiveColumn("management_capability_hash")).toBe(true);
    expect(isSensitiveColumn("encrypted_metadata")).toBe(true);
    expect(isSensitiveColumn("recipient_user_id")).toBe(true);
    expect(isSensitiveColumn("refresh_token")).toBe(true);
    expect(isSensitiveColumn("created_at")).toBe(false);
  });
});
