export function validateDatabaseConfig(
  nodeEnv: string,
  password: string | undefined,
): void {
  if (
    nodeEnv === "production" &&
    (!password || password === "localdev123" || password.length < 16)
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
    (!accessKey ||
      !secretKey ||
      accessKey === "minioadmin" ||
      secretKey === "minioadmin" ||
      secretKey.length < 16)
  ) {
    throw new Error(
      "MINIO_ACCESS_KEY and a non-default MINIO_SECRET_KEY of at least 16 characters are required in production",
    );
  }
}
