const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  on: jest.fn(),
  end: jest.fn(),
};

jest.mock("pg", () => ({
  Pool: jest.fn(() => mockPool),
}));
jest.mock("fs", () => ({
  __esModule: true,
  default: {
    readdirSync: jest.fn(() => ["002_second.sql", "001_first.sql", "notes.md"]),
    readFileSync: jest.fn((file: string) =>
      file.endsWith("001_first.sql")
        ? "BEGIN;\nSELECT 1;\nCOMMIT;"
        : "BEGIN;\nSELECT 2;\nCOMMIT;",
    ),
  },
}));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    query: jest.fn(),
    queryError: jest.fn(),
  },
}));

import {
  isCompatibleMigrationChecksum,
  normalizeMigrationSql,
  runMigrations,
} from "../../../config/database";

describe("database migration runner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT name, checksum")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it("normalizes migration-owned transaction wrappers", () => {
    expect(normalizeMigrationSql("BEGIN;\nSELECT 1;\nCOMMIT;")).toBe(
      "SELECT 1;",
    );
  });

  it("accepts only the pinned historical analytics checksum", () => {
    const historical =
      "4c746cb73ef01e715dc14848e31ef5e3ef0516c77d8726010bee26593fff469a";
    const canonical =
      "a8dbdcce4af445cad98e50263029de8625dc6a9c22a14606280fbc0d2a2ffc6e";
    expect(
      isCompatibleMigrationChecksum(
        "009_privacy_safe_analytics.sql",
        historical,
        canonical,
      ),
    ).toBe(true);
    expect(
      isCompatibleMigrationChecksum(
        "009_privacy_safe_analytics.sql",
        "0".repeat(64),
        canonical,
      ),
    ).toBe(false);
    expect(
      isCompatibleMigrationChecksum(
        "009_privacy_safe_analytics.sql",
        historical,
        "f".repeat(64),
      ),
    ).toBe(false);
  });

  it("applies migrations in order under a lock and records checksums", async () => {
    await runMigrations();

    const statements = mockClient.query.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toBe("SELECT pg_advisory_lock($1)");
    expect(statements.indexOf("SELECT 1;")).toBeLessThan(
      statements.indexOf("SELECT 2;"),
    );
    expect(
      statements.filter((sql) => sql.includes("INSERT INTO schema_migrations")),
    ).toHaveLength(2);
    expect(statements.at(-1)).toBe("SELECT pg_advisory_unlock($1)");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("refuses to rerun a migration whose applied checksum changed", async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes("SELECT name, checksum")) {
        return Promise.resolve({
          rows: [{ name: "001_first.sql", checksum: "0".repeat(64) }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(runMigrations()).rejects.toThrow(
      "Applied migration checksum changed",
    );
    expect(mockClient.release).toHaveBeenCalled();
  });
});
