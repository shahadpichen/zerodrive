import fs from "fs";
import path from "path";
import { deriveRecipientLookupId } from "../../utils/identity";

describe("database privacy invariants", () => {
  const initSql = fs.readFileSync(
    path.resolve(__dirname, "../../../database/init.sql"),
    "utf8",
  );
  const sharedFilesSchema = initSql.match(
    /CREATE TABLE IF NOT EXISTS shared_files \(([\s\S]*?)\n\);/,
  )?.[1];

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
});
