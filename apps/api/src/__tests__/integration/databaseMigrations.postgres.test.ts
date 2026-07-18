import crypto from "crypto";
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
    await testPool.query(
      `INSERT INTO public_keys (user_id, public_key)
       VALUES ($1, 'legacy-public-key')`,
      ["b".repeat(64)],
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

  it("normalizes the known historical analytics migration checksum", async () => {
    const name = "009_privacy_safe_analytics.sql";
    const historical =
      "4c746cb73ef01e715dc14848e31ef5e3ef0516c77d8726010bee26593fff469a";
    const current = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(migrationsDirectory, name), "utf8"))
      .digest("hex");
    await testPool.query(
      "UPDATE schema_migrations SET checksum = $1 WHERE name = $2",
      [historical, name],
    );

    await runMigrationsWithPool(testPool, migrationsDirectory);

    const result = await testPool.query(
      "SELECT checksum FROM schema_migrations WHERE name = $1",
      [name],
    );
    expect(result.rows[0]?.checksum).toBe(current);
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
         to_regclass('public.deployments') IS NOT NULL AS deployments,
         to_regclass('public.idx_deployments_singleton') IS NOT NULL
           AS deployments_singleton,
         to_regclass('public.oauth_exchanges') IS NOT NULL AS oauth_exchanges,
         to_regclass('public.idx_shared_files_management_capability_hash_unique')
           IS NOT NULL AS capability_index,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'shared_files' AND column_name = 'encrypted_metadata'
         ) AS encrypted_metadata,
         to_regclass('public.analytics_daily_summary') IS NOT NULL
           AS analytics_summary,
         to_regclass('public.analytics_daily_dimensions') IS NOT NULL
           AS analytics_dimensions,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'analytics_daily_summary'
             AND column_name = 'total_key_rotations'
         ) AS analytics_lifecycle,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'oauth_exchanges'
             AND column_name = 'id'
         ) AS oauth_uuid_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'analytics_daily_dimensions'
             AND column_name = 'deployment_id'
         ) AS analytics_deployment_id,
         to_regclass('public.idx_analytics_daily_summary_deployment_date_unique')
           IS NOT NULL AS analytics_summary_deployment_unique,
         to_regclass('public.idx_analytics_daily_dimensions_deployment_key_unique')
           IS NOT NULL AS analytics_dimensions_deployment_unique,
         to_regclass('public.idx_oauth_exchanges_deployment_code_hash_unique')
           IS NOT NULL AS oauth_deployment_unique,
         to_regclass('public.idx_public_keys_deployment_user_id')
           IS NOT NULL AS public_keys_deployment_index,
         to_regclass('public.idx_shared_files_deployment_recipient')
           IS NOT NULL AS shared_files_deployment_index,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'active_shared_files'
             AND column_name = 'deployment_id'
         ) AS active_shared_files_deployment_id`,
    );
    expect(result.rows[0]).toEqual({
      deployments: true,
      deployments_singleton: true,
      oauth_exchanges: true,
      capability_index: true,
      encrypted_metadata: true,
      analytics_summary: true,
      analytics_dimensions: true,
      analytics_lifecycle: true,
      oauth_uuid_id: true,
      analytics_deployment_id: true,
      analytics_summary_deployment_unique: true,
      analytics_dimensions_deployment_unique: true,
      oauth_deployment_unique: true,
      public_keys_deployment_index: true,
      shared_files_deployment_index: true,
      active_shared_files_deployment_id: true,
    });
  });

  it("keeps deployment identity singleton for this rollout stage", async () => {
    await expect(
      testPool.query("INSERT INTO deployments DEFAULT VALUES"),
    ).rejects.toThrow();
  });

  it("backfills the deployment foundation for legacy production rows", async () => {
    const result = await testPool.query(
      `SELECT
         (SELECT count(*)::integer FROM deployments) AS deployment_count,
         (SELECT deployment_id IS NOT NULL
            FROM shared_files
           WHERE file_id = 'shared/legacy-object') AS shared_file_backfilled,
         (SELECT deployment_id IS NOT NULL
            FROM public_keys
           WHERE user_id = $1) AS public_key_backfilled`,
      ["b".repeat(64)],
    );

    expect(result.rows[0]).toEqual({
      deployment_count: 1,
      shared_file_backfilled: true,
      public_key_backfilled: true,
    });
  });

  it("exposes only finalized active shares through the active view", async () => {
    const recipientId = "c".repeat(64);
    await testPool.query(
      `INSERT INTO shared_files
         (file_id, recipient_user_id, encrypted_file_key,
          encrypted_metadata, file_size, expected_encrypted_size, status)
       VALUES
         ('shared/pending-view-test', $1, 'pending-key',
          '{"version":1,"ciphertext":"pending"}', 10, 12, 'pending'),
         ('shared/active-view-test', $1, 'active-key',
          '{"version":1,"ciphertext":"active"}', 10, 12, 'active')`,
      [recipientId],
    );

    const result = await testPool.query(
      `SELECT file_id
         FROM active_shared_files
        WHERE recipient_user_id = $1
        ORDER BY file_id`,
      [recipientId],
    );

    expect(result.rows).toEqual([{ file_id: "shared/active-view-test" }]);
  });
});
