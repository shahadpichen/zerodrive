const PLACEHOLDER_MARKERS = [
  "change_me",
  "changeme",
  "replace_me",
  "placeholder",
  "your_jwt_secret",
  "your_independent",
];

export function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true;

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function validateDatabaseConfig(
  nodeEnv: string,
  password: string | undefined,
): void {
  if (
    nodeEnv === "production" &&
    (isPlaceholderValue(password) ||
      password === "localdev123" ||
      password!.length < 16)
  ) {
    throw new Error(
      "DB_PASSWORD must be a non-default value of at least 16 characters in production",
    );
  }
}

export function validateS3Config(
  nodeEnv: string,
  accessKey: string | undefined,
  secretKey: string | undefined,
): void {
  if (
    nodeEnv === "production" &&
    (isPlaceholderValue(accessKey) ||
      isPlaceholderValue(secretKey) ||
      accessKey === "minioadmin" ||
      secretKey === "minioadmin" ||
      secretKey!.length < 16)
  ) {
    throw new Error(
      "MINIO_ACCESS_KEY and a non-default MINIO_SECRET_KEY of at least 16 characters are required in production",
    );
  }
}

export function validateGoogleOAuthConfig(
  nodeEnv: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
  redirectUri: string | undefined,
): void {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth configuration is incomplete");
  }

  if (
    nodeEnv === "production" &&
    (isPlaceholderValue(clientId) || isPlaceholderValue(clientSecret))
  ) {
    throw new Error("Google OAuth credentials contain placeholder values");
  }

  if (nodeEnv === "production") {
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      throw new Error("GOOGLE_REDIRECT_URI must be a valid HTTPS URL");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("GOOGLE_REDIRECT_URI must be a valid HTTPS URL");
    }
  }
}

export function validateS3PublicEndpoint(
  nodeEnv: string,
  publicEndpoint: string | undefined,
): void {
  if (nodeEnv !== "production") return;

  if (!publicEndpoint) {
    throw new Error("MINIO_PUBLIC_ENDPOINT is required in production");
  }

  let parsed: URL;
  try {
    parsed = new URL(publicEndpoint);
  } catch {
    throw new Error("MINIO_PUBLIC_ENDPOINT must be a valid HTTPS URL");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error(
      "MINIO_PUBLIC_ENDPOINT must be an HTTPS origin without credentials, path, query, or fragment",
    );
  }
}

export function validateAllowedOrigins(
  nodeEnv: string,
  configuredOrigins: string | undefined,
): void {
  if (nodeEnv !== "production") return;

  if (!configuredOrigins) {
    throw new Error("ALLOWED_ORIGINS is required in production");
  }

  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("ALLOWED_ORIGINS cannot contain a wildcard in production");
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("ALLOWED_ORIGINS must contain valid HTTPS origins");
    }

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("ALLOWED_ORIGINS must contain valid HTTPS origins");
    }
  }
}
