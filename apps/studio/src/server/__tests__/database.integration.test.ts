// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StudioDatabase } from "../database";
import { loadStudioConfig } from "../config";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("Studio PostgreSQL integration", () => {
  const config = loadStudioConfig({
    NODE_ENV: "test",
    STUDIO_DATABASE_URL: databaseUrl,
  });
  const database = new StudioDatabase(config);

  beforeAll(async () => {
    await database.pool.query(`
      DROP TABLE IF EXISTS public.studio_test_items;
      CREATE TABLE public.studio_test_items (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        encrypted_metadata TEXT
      );
      INSERT INTO public.studio_test_items (label, encrypted_metadata)
      VALUES ('first', 'ciphertext');
    `);
  });

  afterAll(async () => {
    await database.pool.query("DROP TABLE IF EXISTS public.studio_test_items");
    await database.close();
  });

  it("introspects relations, columns, primary keys, and sensitive fields", async () => {
    expect(
      (await database.listRelations()).some(
        (item) => item.name === "studio_test_items",
      ),
    ).toBe(true);
    const details = await database.getRelationDetails(
      "public",
      "studio_test_items",
    );
    expect(details.primaryKey).toEqual(["id"]);
    expect(details.editable).toBe(true);
    expect(
      details.columns.find((column) => column.name === "encrypted_metadata")
        ?.sensitive,
    ).toBe(true);
  });

  it("paginates, filters, and safely mutates local rows", async () => {
    const inserted = await database.insertRow("public", "studio_test_items", {
      label: "second",
    });
    const filtered = await database.getRows("public", "studio_test_items", {
      offset: 0,
      limit: 10,
      filterColumn: "label",
      filterValue: "second",
    });
    expect(filtered.rows).toHaveLength(1);
    const updated = await database.updateRow(
      "public",
      "studio_test_items",
      { id: inserted.id },
      { label: "updated" },
    );
    expect(updated.label).toBe("updated");
    await database.deleteRow("public", "studio_test_items", {
      id: inserted.id,
    });
  });

  it("requires confirmation for destructive local SQL", async () => {
    await expect(
      database.executeQuery("DELETE FROM studio_test_items", false),
    ).rejects.toMatchObject({ code: "CONFIRM_DESTRUCTIVE" });
    const result = await database.executeQuery(
      "SELECT label FROM studio_test_items",
      false,
    );
    expect(result.fields).toEqual(["label"]);
  });

  it("enforces read-only production queries with a dedicated PostgreSQL role", async () => {
    const reader = "studio_integration_reader";
    await database.pool.query(`DROP ROLE IF EXISTS ${reader}`);
    await database.pool.query(`CREATE ROLE ${reader}
      LOGIN PASSWORD 'studio-integration-only'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await database.pool.query(
      `ALTER ROLE ${reader} SET default_transaction_read_only = on`,
    );
    await database.pool.query(`GRANT USAGE ON SCHEMA public TO ${reader}`);
    await database.pool.query(
      `GRANT SELECT ON public.studio_test_items TO ${reader}`,
    );

    const readerUrl = new URL(databaseUrl!);
    readerUrl.username = reader;
    readerUrl.password = "studio-integration-only";
    const production = new StudioDatabase(
      loadStudioConfig({
        NODE_ENV: "test",
        STUDIO_PROFILE: "production",
        STUDIO_DATABASE_URL: readerUrl.toString(),
      }),
    );
    try {
      await expect(
        production.verifyProductionSafety(),
      ).resolves.toBeUndefined();
      const selected = await production.executeQuery(
        "SELECT label FROM public.studio_test_items ORDER BY id",
        false,
      );
      expect(selected.rows[0]?.label).toBe("first");
      await expect(
        production.executeQuery(
          "UPDATE public.studio_test_items SET label = 'changed'",
          false,
        ),
      ).rejects.toThrow("Production Studio accepts");
    } finally {
      await production.close();
      await database.pool.query(`DROP OWNED BY ${reader}`);
      await database.pool.query(`DROP ROLE ${reader}`);
    }
  });
});
