import fs from "fs";
import path from "path";
import {
  deriveLegacyRecipientLookupId,
  deriveRecipientLookupId,
} from "../../utils/identity";

describe("database privacy invariants", () => {
  const initSql = fs.readFileSync(
    path.resolve(__dirname, "../../../database/init.sql"),
    "utf8",
  );
  const sharedFilesSchema = initSql.match(
    /CREATE TABLE IF NOT EXISTS shared_files \(([\s\S]*?)\n\);/,
  )?.[1];
  const plaintextPurgeMigration = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../database/migrations/007_purge_legacy_plaintext_metadata.sql",
    ),
    "utf8",
  );

  it("has no sender identity or plaintext recipient columns", () => {
    expect(sharedFilesSchema).toBeDefined();
    for (const forbidden of [
      "sender_user_id",
      "sender_email",
      "sender_email_hash",
      "recipient_email ",
      "google_account",
      "user_agent",
      "ip_address",
    ]) {
      expect(sharedFilesSchema!.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("uses unique opaque object and capability identifiers", () => {
    expect(initSql).toContain("idx_shared_files_file_id_unique");
    expect(initSql).toContain(
      "idx_shared_files_management_capability_hash_unique",
    );
  });

  it("stores no OAuth token payload or account identifier", () => {
    const oauthSchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS oauth_exchanges \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(oauthSchema).toBeDefined();
    expect(oauthSchema).toContain("code_hash");
    for (const forbidden of [
      "access_token",
      "refresh_token",
      "owner_hash",
      "user_id",
      "email",
    ]) {
      expect(oauthSchema!.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("stores analytics as aggregate counters without identity columns", () => {
    const summarySchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS analytics_daily_summary \(([\s\S]*?)\n\);/,
    )?.[1];
    const dimensionsSchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS analytics_daily_dimensions \(([\s\S]*?)\n\);/,
    )?.[1];
    const monthlySummarySchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS analytics_monthly_summary \(([\s\S]*?)\n\);/,
    )?.[1];
    const monthlyDimensionsSchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS analytics_monthly_dimensions \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(summarySchema).toBeDefined();
    expect(dimensionsSchema).toBeDefined();
    expect(monthlySummarySchema).toBeDefined();
    expect(monthlyDimensionsSchema).toBeDefined();

    const analyticsSchema =
      `${summarySchema}\n${dimensionsSchema}\n${monthlySummarySchema}\n${monthlyDimensionsSchema}`.toLowerCase();
    for (const forbidden of [
      "email",
      "user_id",
      "email_hash",
      "ip_address",
      "user_agent",
      "session_id",
      "device_id",
      "file_id",
      "share_id",
      "object_key",
      "request_body",
      "event_timestamp",
      "raw_url",
      "query_string",
      "referrer",
    ]) {
      expect(analyticsSchema).not.toContain(forbidden);
    }
  });

  it("stores legal acceptance without plaintext account identity", () => {
    const legalSchema = initSql.match(
      /CREATE TABLE IF NOT EXISTS legal_acceptances \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(legalSchema).toBeDefined();
    expect(legalSchema).toContain("account_lookup_id");
    for (const forbidden of [
      "email",
      "user_id",
      "google_account",
      "ip_address",
      "user_agent",
      "session_id",
      "request_id",
    ]) {
      expect(legalSchema!.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("cannot derive recipient identities without the external secret", () => {
    const previousSecret = process.env.DIRECTORY_HMAC_SECRET;
    process.env.DIRECTORY_HMAC_SECRET = "first-independent-secret";
    const first = deriveRecipientLookupId("Person@Example.com");
    process.env.DIRECTORY_HMAC_SECRET = "second-independent-secret";
    const second = deriveRecipientLookupId("person@example.com");

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("person");
    if (previousSecret) process.env.DIRECTORY_HMAC_SECRET = previousSecret;
    else delete process.env.DIRECTORY_HMAC_SECRET;
  });

  it("uses the original salt only for legacy identifier compatibility", () => {
    const previousDirectorySecret = process.env.DIRECTORY_HMAC_SECRET;
    const previousLegacySecret = process.env.EMAIL_HASH_SALT;
    process.env.DIRECTORY_HMAC_SECRET = "new-independent-secret";
    process.env.EMAIL_HASH_SALT = "actual-legacy-secret";
    const legacy = deriveLegacyRecipientLookupId("person@example.com");
    process.env.DIRECTORY_HMAC_SECRET = "different-new-secret";

    expect(deriveLegacyRecipientLookupId("person@example.com")).toBe(legacy);
    process.env.DIRECTORY_HMAC_SECRET = previousDirectorySecret;
    process.env.EMAIL_HASH_SALT = previousLegacySecret;
  });

  it("purges legacy plaintext metadata during deployment migration", () => {
    expect(plaintextPurgeMigration).toContain("SET file_name = NULL");
    expect(plaintextPurgeMigration).toContain("mime_type = NULL");
  });
});
