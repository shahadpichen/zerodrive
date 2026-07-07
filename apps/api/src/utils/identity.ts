import crypto from "crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getDirectorySecret(): string {
  const secret = process.env.DIRECTORY_HMAC_SECRET;

  if (!secret) {
    throw new Error("DIRECTORY_HMAC_SECRET is not configured");
  }

  return secret;
}

function getLegacyDirectorySecret(): string | null {
  return process.env.EMAIL_HASH_SALT || null;
}

export function deriveRecipientLookupId(email: string): string {
  return crypto
    .createHmac("sha256", getDirectorySecret())
    .update(normalizeEmail(email))
    .digest("hex");
}

export function deriveLegacyRecipientLookupId(email: string): string {
  const legacySecret = getLegacyDirectorySecret();
  if (!legacySecret) {
    throw new Error(
      "EMAIL_HASH_SALT is required while legacy identifiers are supported",
    );
  }
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email) + legacySecret)
    .digest("hex");
}

export function deriveLookupCandidates(email: string): string[] {
  return [deriveRecipientLookupId(email), deriveLegacyRecipientLookupId(email)];
}

export function validateIdentitySecrets(): void {
  const directorySecret = process.env.DIRECTORY_HMAC_SECRET;
  if (
    !directorySecret ||
    directorySecret.length < 32 ||
    directorySecret.includes("your-independent")
  ) {
    throw new Error(
      "DIRECTORY_HMAC_SECRET must be configured with at least 32 non-placeholder characters",
    );
  }
  if (!process.env.EMAIL_HASH_SALT) {
    throw new Error(
      "EMAIL_HASH_SALT is required until legacy identifier migration is retired",
    );
  }
}
