import crypto from "crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getDirectorySecret(): string {
  const secret =
    process.env.DIRECTORY_HMAC_SECRET || process.env.EMAIL_HASH_SALT;

  if (!secret) {
    throw new Error("DIRECTORY_HMAC_SECRET is not configured");
  }

  return secret;
}

export function deriveRecipientLookupId(email: string): string {
  return crypto
    .createHmac("sha256", getDirectorySecret())
    .update(normalizeEmail(email))
    .digest("hex");
}

export function deriveLegacyRecipientLookupId(email: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email) + getDirectorySecret())
    .digest("hex");
}

export function deriveLookupCandidates(email: string): string[] {
  return [deriveRecipientLookupId(email), deriveLegacyRecipientLookupId(email)];
}
