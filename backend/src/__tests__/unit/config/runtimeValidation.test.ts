import {
  validateDatabaseConfig,
  validateS3Config,
} from "../../../config/runtimeValidation";

describe("production runtime configuration", () => {
  it("rejects missing, default, and weak database passwords in production", () => {
    expect(() => validateDatabaseConfig("production", undefined)).toThrow(
      "DB_PASSWORD",
    );
    expect(() => validateDatabaseConfig("production", "localdev123")).toThrow(
      "DB_PASSWORD",
    );
    expect(() => validateDatabaseConfig("production", "short")).toThrow(
      "DB_PASSWORD",
    );
  });

  it("rejects missing and default object-storage credentials in production", () => {
    expect(() => validateS3Config("production", undefined, undefined)).toThrow(
      "MINIO_ACCESS_KEY",
    );
    expect(() =>
      validateS3Config("production", "minioadmin", "minioadmin"),
    ).toThrow("MINIO_ACCESS_KEY");
  });

  it("accepts explicit production credentials and development defaults", () => {
    expect(() =>
      validateDatabaseConfig("production", "strong-database-password"),
    ).not.toThrow();
    expect(() =>
      validateS3Config(
        "production",
        "zerodrive-storage",
        "strong-storage-secret",
      ),
    ).not.toThrow();
    expect(() =>
      validateDatabaseConfig("development", undefined),
    ).not.toThrow();
    expect(() =>
      validateS3Config("development", undefined, undefined),
    ).not.toThrow();
  });
});
