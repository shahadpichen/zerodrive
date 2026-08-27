import {
  validateAllowedOrigins,
  validateDatabaseConfig,
  validateGoogleOAuthConfig,
  validateS3Config,
  validateS3PublicEndpoint,
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
    expect(() =>
      validateDatabaseConfig(
        "production",
        "CHANGE_ME_RANDOM_DATABASE_PASSWORD",
      ),
    ).toThrow("DB_PASSWORD");
  });

  it("requires a clean HTTPS public object-storage origin in production", () => {
    expect(() => validateS3PublicEndpoint("production", undefined)).toThrow(
      "MINIO_PUBLIC_ENDPOINT is required",
    );
    expect(() =>
      validateS3PublicEndpoint("production", "http://files.example.com"),
    ).toThrow("must be an HTTPS origin");
    expect(() =>
      validateS3PublicEndpoint(
        "production",
        "https://user:secret@files.example.com/path",
      ),
    ).toThrow("must be an HTTPS origin");
    expect(() =>
      validateS3PublicEndpoint("production", "https://files.example.com"),
    ).not.toThrow();
    expect(() =>
      validateS3PublicEndpoint("development", undefined),
    ).not.toThrow();
  });

  it("rejects missing and default object-storage credentials in production", () => {
    expect(() => validateS3Config("production", undefined, undefined)).toThrow(
      "MINIO_ACCESS_KEY",
    );
    expect(() =>
      validateS3Config("production", "minioadmin", "minioadmin"),
    ).toThrow("MINIO_ACCESS_KEY");
    expect(() =>
      validateS3Config(
        "production",
        "CHANGE_ME_RANDOM_ACCESS_KEY",
        "CHANGE_ME_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
      ),
    ).toThrow("MINIO_ACCESS_KEY");
  });

  it("rejects incomplete, placeholder, and insecure production OAuth settings", () => {
    expect(() =>
      validateGoogleOAuthConfig("production", undefined, undefined, undefined),
    ).toThrow("incomplete");
    expect(() =>
      validateGoogleOAuthConfig(
        "production",
        "CHANGE_ME.apps.googleusercontent.com",
        "CHANGE_ME",
        "https://api.example.com/api/auth/callback/google",
      ),
    ).toThrow("placeholder");
    expect(() =>
      validateGoogleOAuthConfig(
        "production",
        "client.apps.googleusercontent.com",
        "strong-google-client-secret",
        "http://api.example.com/api/auth/callback/google",
      ),
    ).toThrow("HTTPS");
    expect(() =>
      validateGoogleOAuthConfig(
        "production",
        "client.apps.googleusercontent.com",
        "strong-google-client-secret",
        "https://api.example.com/api/auth/callback/google",
      ),
    ).not.toThrow();
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

  it("requires explicit HTTPS CORS origins in production", () => {
    expect(() => validateAllowedOrigins("production", undefined)).toThrow(
      "ALLOWED_ORIGINS",
    );
    expect(() => validateAllowedOrigins("production", "*")).toThrow(
      "wildcard",
    );
    expect(() =>
      validateAllowedOrigins("production", "http://zerodrive.example"),
    ).toThrow("HTTPS origins");
    expect(() =>
      validateAllowedOrigins(
        "production",
        "https://zerodrive.example,https://app.zerodrive.example",
      ),
    ).not.toThrow();
    expect(() => validateAllowedOrigins("development", "*")).not.toThrow();
  });
});
