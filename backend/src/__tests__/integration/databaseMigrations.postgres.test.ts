import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { closePool, runMigrationsWithPool } from "../../config/database";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("database migrations against PostgreSQL", () => {
  let testPool: Pool;
  const databaseDirectory = path.resolve(__dirname, "../../../database");
  const legacySchema = path.resolve(__dirname, "../fixtures/legacy-schema.sql");
  const migrationsDirectory = path.join(databaseDirectory, "migrations");

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);
    if (!parsed.pathname.endsWith("_test")) {
      throw new Error(
        "TEST_DATABASE_URL must target a database ending in _test",
      );
    }
    testPool = new Pool({ connectionString: databaseUrl });
    await testPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await testPool.query(fs.readFileSync(legacySchema, "utf8"));
    await testPool.query(
      `INSERT INTO shared_files
         (file_id, recipient_user_id, encrypted_file_key, file_name,
          file_size, mime_type)
       VALUES
         ('shared/legacy-object', $1, 'legacy-wrapped-key',
          'legacy-secret.txt', 42, 'text/plain')`,
      ["a".repeat(64)],
    );
    await runMigrationsWithPool(testPool, migrationsDirectory);
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      await testPool.end();
    }
    await closePool();
  });

  it("applies the complete migration set and is idempotent", async () => {
    await runMigrationsWithPool(testPool, migrationsDirectory);

    const migrationFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((file) => /^\d+_.+\.sql$/.test(file));
    const applied = await testPool.query(
      "SELECT name, checksum FROM schema_migrations ORDER BY name",
    );
    expect(applied.rows).toHaveLength(migrationFiles.length);
    expect(
      applied.rows.every((row) => /^[0-9a-f]{64}$/.test(row.checksum)),
    ).toBe(true);
  });

  it("purges legacy plaintext metadata on a real database", async () => {
    const result = await testPool.query(
      `SELECT file_name, mime_type
       FROM shared_files
       WHERE file_id = 'shared/legacy-object'`,
    );
    expect(result.rows[0]).toEqual({ file_name: null, mime_type: null });
  });

  it("creates the current security and lifecycle structures", async () => {
    const result = await testPool.query(
      `SELECT
         to_regclass('public.oauth_exchanges') IS NOT NULL AS oauth_exchanges,
         to_regclass('public.idx_shared_files_management_capability_hash_unique')
           IS NOT NULL AS capability_index,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'shared_files' AND column_name = 'encrypted_metadata'
         ) AS encrypted_metadata`,
    );
    expect(result.rows[0]).toEqual({
      oauth_exchanges: true,
      capability_index: true,
      encrypted_metadata: true,
    });
  });
});
