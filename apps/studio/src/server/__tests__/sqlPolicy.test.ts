// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  quoteIdentifier,
  requiresDestructiveConfirmation,
  validateProductionQuery,
} from "../sqlPolicy";

describe("Studio SQL policy", () => {
  it("accepts one SELECT or EXPLAIN SELECT in production", () => {
    expect(
      validateProductionQuery("SELECT count(*) FROM shared_files;").kind,
    ).toBe("select");
    expect(
      validateProductionQuery("EXPLAIN (ANALYZE false) SELECT 1").kind,
    ).toBe("explain");
  });

  it("rejects writes and multiple statements in production", () => {
    expect(() =>
      validateProductionQuery("UPDATE shared_files SET status = 'active'"),
    ).toThrow();
    expect(() => validateProductionQuery("SELECT 1; SELECT 2")).toThrow();
  });

  it("requires confirmation for destructive local statements", () => {
    expect(requiresDestructiveConfirmation("select * from shared_files")).toBe(
      false,
    );
    expect(requiresDestructiveConfirmation("delete from shared_files")).toBe(
      true,
    );
    expect(
      requiresDestructiveConfirmation(
        "WITH changed AS (UPDATE x SET y=1 RETURNING *) SELECT * FROM changed",
      ),
    ).toBe(true);
  });

  it("quotes PostgreSQL identifiers instead of interpolating them", () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
    expect(() => quoteIdentifier("bad\0name")).toThrow();
  });
});
