import { Pool, QueryResult } from "pg";
import type {
  ColumnInfo,
  ConnectionOverview,
  ConstraintInfo,
  IndexInfo,
  QueryResponse,
  RelationDetails,
  RelationSummary,
  RowsResponse,
} from "../shared/types";
import type { StudioConfig } from "./config";
import { isSensitiveColumn } from "./sensitive";
import {
  quoteIdentifier,
  requiresDestructiveConfirmation,
  validateProductionQuery,
} from "./sqlPolicy";

interface RelationLookup {
  relation: RelationSummary;
  columns: ColumnInfo[];
  primaryKey: string[];
}

function duration(start: number): number {
  return Math.max(0, Date.now() - start);
}

function normalizeResult(result: QueryResult | QueryResult[]): QueryResult {
  return Array.isArray(result) ? result[result.length - 1]! : result;
}

export class StudioDatabase {
  readonly pool: Pool;

  constructor(private readonly config: StudioConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 4,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 5_000,
      application_name: `zerodrive-studio-${config.profile}`,
      statement_timeout: config.queryTimeoutMs,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async verifyProductionSafety(): Promise<void> {
    if (this.config.profile !== "production") return;
    const result = await this.pool.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      transaction_read_only: string;
      writable_tables: string;
    }>(`
      SELECT
        r.rolsuper,
        r.rolbypassrls,
        current_setting('transaction_read_only') AS transaction_read_only,
        COALESCE((
          SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
          FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            AND (
              has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'INSERT')
              OR has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'UPDATE')
              OR has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'DELETE')
              OR has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'TRUNCATE')
            )
        ), '') AS writable_tables
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);
    const row = result.rows[0];
    if (!row) throw new Error("Unable to verify the production database role");
    if (row.rolsuper || row.rolbypassrls) {
      throw new Error("Production Studio refuses privileged PostgreSQL roles");
    }
    if (row.transaction_read_only !== "on") {
      throw new Error("Production Studio requires transaction_read_only=on");
    }
    if (row.writable_tables) {
      throw new Error(
        "Production Studio role has application-table write access",
      );
    }
  }

  async getOverview(): Promise<ConnectionOverview> {
    const start = Date.now();
    const result = await this.pool.query<{
      database: string;
      user_name: string;
      version: string;
      read_only: string;
      table_count: string;
      view_count: string;
    }>(`
      SELECT
        current_database() AS database,
        current_user AS user_name,
        split_part(version(), ',', 1) AS version,
        current_setting('transaction_read_only') AS read_only,
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE') AS table_count,
        (SELECT count(*) FROM information_schema.views
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) AS view_count
    `);
    const row = result.rows[0]!;
    const migrationTable = await this.pool.query<{ exists: boolean }>(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists",
    );
    let migrationCount = 0;
    let latestMigration: string | null = null;
    if (migrationTable.rows[0]?.exists) {
      const migrations = await this.pool.query<{
        migration_count: string;
        latest_migration: string | null;
      }>(`SELECT count(*) AS migration_count,
        (SELECT name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1) AS latest_migration
        FROM schema_migrations`);
      migrationCount = Number(migrations.rows[0]?.migration_count || 0);
      latestMigration = migrations.rows[0]?.latest_migration || null;
    }
    return {
      profile: this.config.profile,
      database: row.database,
      user: row.user_name,
      version: row.version,
      latencyMs: duration(start),
      readOnly: row.read_only === "on" || this.config.profile === "production",
      tableCount: Number(row.table_count),
      viewCount: Number(row.view_count),
      migrationCount,
      latestMigration,
    };
  }

  async listRelations(): Promise<RelationSummary[]> {
    const result = await this.pool.query<{
      schema: string;
      name: string;
      kind: "table" | "view";
      estimated_rows: string;
    }>(`
      SELECT
        n.nspname AS schema,
        c.relname AS name,
        CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
        GREATEST(c.reltuples, 0)::bigint AS estimated_rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p', 'v', 'm')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname !~ '^pg_toast'
      ORDER BY n.nspname, kind, c.relname
    `);
    return result.rows.map((row) => ({
      schema: row.schema,
      name: row.name,
      kind: row.kind,
      estimatedRows: Number(row.estimated_rows),
    }));
  }

  private async lookupRelation(
    schema: string,
    name: string,
  ): Promise<RelationLookup> {
    const relationResult = await this.pool.query<{
      schema: string;
      name: string;
      kind: "table" | "view";
      estimated_rows: string;
    }>(
      `SELECT n.nspname AS schema, c.relname AS name,
        CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
        GREATEST(c.reltuples, 0)::bigint AS estimated_rows
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p', 'v', 'm')`,
      [schema, name],
    );
    const relationRow = relationResult.rows[0];
    if (!relationRow) throw new Error("Relation not found");

    const columnsResult = await this.pool.query<{
      name: string;
      data_type: string;
      nullable: boolean;
      default_value: string | null;
      primary_key: boolean;
      foreign_key: string | null;
    }>(
      `SELECT
        a.attname AS name,
        format_type(a.atttypid, a.atttypmod) AS data_type,
        NOT a.attnotnull AS nullable,
        pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
        COALESCE(i.indisprimary AND a.attnum = ANY(i.indkey), false) AS primary_key,
        fk.foreign_key
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
       LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
       LEFT JOIN LATERAL (
         SELECT format('%I.%I', fn.nspname, fc.relname) AS foreign_key
         FROM pg_constraint con
         JOIN pg_class fc ON fc.oid = con.confrelid
         JOIN pg_namespace fn ON fn.oid = fc.relnamespace
         WHERE con.conrelid = c.oid AND con.contype = 'f'
           AND a.attnum = ANY(con.conkey)
         LIMIT 1
       ) fk ON true
       WHERE n.nspname = $1 AND c.relname = $2
         AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [schema, name],
    );
    const columns = columnsResult.rows.map((row) => ({
      name: row.name,
      dataType: row.data_type,
      nullable: row.nullable,
      defaultValue: row.default_value,
      primaryKey: row.primary_key,
      foreignKey: row.foreign_key,
      sensitive: isSensitiveColumn(row.name),
    }));
    return {
      relation: {
        schema: relationRow.schema,
        name: relationRow.name,
        kind: relationRow.kind,
        estimatedRows: Number(relationRow.estimated_rows),
      },
      columns,
      primaryKey: columns
        .filter((column) => column.primaryKey)
        .map((column) => column.name),
    };
  }

  async getRelationDetails(
    schema: string,
    name: string,
  ): Promise<RelationDetails> {
    const lookup = await this.lookupRelation(schema, name);
    const [indexes, constraints] = await Promise.all([
      this.pool.query<IndexInfo>(
        `SELECT indexname AS name, indexdef AS definition FROM pg_indexes
         WHERE schemaname = $1 AND tablename = $2 ORDER BY indexname`,
        [schema, name],
      ),
      this.pool.query<ConstraintInfo>(
        `SELECT con.conname AS name,
          CASE con.contype WHEN 'p' THEN 'primary key' WHEN 'f' THEN 'foreign key'
            WHEN 'u' THEN 'unique' WHEN 'c' THEN 'check' ELSE con.contype::text END AS type,
          pg_get_constraintdef(con.oid, true) AS definition
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relname = $2 ORDER BY con.conname`,
        [schema, name],
      ),
    ]);
    return {
      ...lookup,
      indexes: indexes.rows,
      constraints: constraints.rows,
      editable:
        this.config.profile === "local" &&
        lookup.relation.kind === "table" &&
        lookup.primaryKey.length > 0,
    };
  }

  async getRows(
    schema: string,
    name: string,
    options: {
      offset: number;
      limit: number;
      sort?: string;
      direction?: "asc" | "desc";
      filterColumn?: string;
      filterValue?: string;
    },
  ): Promise<RowsResponse> {
    const lookup = await this.lookupRelation(schema, name);
    const columnNames = new Set(lookup.columns.map((column) => column.name));
    if (options.sort && !columnNames.has(options.sort))
      throw new Error("Unknown sort column");
    if (options.filterColumn && !columnNames.has(options.filterColumn)) {
      throw new Error("Unknown filter column");
    }
    const params: unknown[] = [];
    let where = "";
    if (options.filterColumn && options.filterValue !== undefined) {
      params.push(`%${options.filterValue}%`);
      where = `WHERE ${quoteIdentifier(options.filterColumn)}::text ILIKE $${params.length}`;
    }
    const sort =
      options.sort || lookup.primaryKey[0] || lookup.columns[0]?.name;
    const order = sort
      ? `ORDER BY ${quoteIdentifier(sort)} ${options.direction === "desc" ? "DESC" : "ASC"}`
      : "";
    params.push(options.limit + 1, options.offset);
    const table = `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
    const result = await this.pool.query(
      `SELECT * FROM ${table} ${where} ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: result.rows.slice(0, options.limit),
      columns: lookup.columns,
      offset: options.offset,
      limit: options.limit,
      hasMore: result.rows.length > options.limit,
    };
  }

  private assertLocal(): void {
    if (this.config.profile !== "local") {
      throw new Error("Production Studio is read-only");
    }
  }

  private validateValues(
    columns: ColumnInfo[],
    values: Record<string, unknown>,
  ): void {
    const allowed = new Set(columns.map((column) => column.name));
    const keys = Object.keys(values);
    if (keys.length === 0 || keys.some((key) => !allowed.has(key))) {
      throw new Error("Mutation contains unknown or empty columns");
    }
  }

  async insertRow(
    schema: string,
    name: string,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.assertLocal();
    const lookup = await this.lookupRelation(schema, name);
    this.validateValues(lookup.columns, values);
    const keys = Object.keys(values);
    const params = keys.map((key) => values[key]);
    const result = await this.pool.query(
      `INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(name)}
       (${keys.map(quoteIdentifier).join(", ")}) VALUES
       (${keys.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`,
      params,
    );
    return result.rows[0];
  }

  async updateRow(
    schema: string,
    name: string,
    primaryKey: Record<string, unknown>,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.assertLocal();
    const lookup = await this.lookupRelation(schema, name);
    this.validateValues(lookup.columns, values);
    this.validatePrimaryKey(lookup, primaryKey);
    const valueKeys = Object.keys(values);
    const primaryKeys = Object.keys(primaryKey);
    const params = [
      ...valueKeys.map((key) => values[key]),
      ...primaryKeys.map((key) => primaryKey[key]),
    ];
    const set = valueKeys
      .map((key, index) => `${quoteIdentifier(key)} = $${index + 1}`)
      .join(", ");
    const where = primaryKeys
      .map(
        (key, index) =>
          `${quoteIdentifier(key)} IS NOT DISTINCT FROM $${valueKeys.length + index + 1}`,
      )
      .join(" AND ");
    const result = await this.pool.query(
      `UPDATE ${quoteIdentifier(schema)}.${quoteIdentifier(name)} SET ${set} WHERE ${where} RETURNING *`,
      params,
    );
    if (!result.rows[0]) throw new Error("Row not found");
    return result.rows[0];
  }

  async deleteRow(
    schema: string,
    name: string,
    primaryKey: Record<string, unknown>,
  ): Promise<void> {
    this.assertLocal();
    const lookup = await this.lookupRelation(schema, name);
    this.validatePrimaryKey(lookup, primaryKey);
    const keys = Object.keys(primaryKey);
    const result = await this.pool.query(
      `DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier(name)} WHERE ${keys
        .map(
          (key, index) =>
            `${quoteIdentifier(key)} IS NOT DISTINCT FROM $${index + 1}`,
        )
        .join(" AND ")}`,
      keys.map((key) => primaryKey[key]),
    );
    if (result.rowCount !== 1) throw new Error("Row not found");
  }

  private validatePrimaryKey(
    lookup: RelationLookup,
    primaryKey: Record<string, unknown>,
  ): void {
    const supplied = Object.keys(primaryKey).sort();
    const expected = [...lookup.primaryKey].sort();
    if (
      expected.length === 0 ||
      JSON.stringify(supplied) !== JSON.stringify(expected)
    ) {
      throw new Error("A complete primary key is required");
    }
  }

  async executeQuery(
    sql: string,
    confirmDestructive: boolean,
  ): Promise<QueryResponse> {
    const start = Date.now();
    if (this.config.profile === "local") {
      if (requiresDestructiveConfirmation(sql) && !confirmDestructive) {
        const error = new Error("Destructive SQL requires confirmation");
        (error as Error & { code?: string }).code = "CONFIRM_DESTRUCTIVE";
        throw error;
      }
      const result = normalizeResult(await this.pool.query(sql));
      return this.toQueryResponse(result, start, false);
    }

    const validated = validateProductionQuery(sql);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        `SET LOCAL statement_timeout = ${this.config.queryTimeoutMs}`,
      );
      let result: QueryResult;
      if (validated.kind === "select") {
        await client.query(
          `DECLARE studio_result NO SCROLL CURSOR FOR ${validated.sql}`,
        );
        result = await client.query(
          `FETCH FORWARD ${this.config.maxRows + 1} FROM studio_result`,
        );
        await client.query("CLOSE studio_result");
      } else {
        result = await client.query(validated.sql);
      }
      await client.query("COMMIT");
      return this.toQueryResponse(result, start, true);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private toQueryResponse(
    result: QueryResult,
    start: number,
    rawWarning: boolean,
  ): QueryResponse {
    const truncated = result.rows.length > this.config.maxRows;
    const rows = result.rows.slice(0, this.config.maxRows);
    return {
      command: result.command || "QUERY",
      fields: result.fields.map((field) => field.name),
      rows,
      rowCount: result.rowCount ?? rows.length,
      truncated,
      durationMs: duration(start),
      requiresRawDataWarning: rawWarning,
    };
  }
}
