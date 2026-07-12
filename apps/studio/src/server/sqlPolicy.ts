import { parse } from "pgsql-ast-parser";

const DESTRUCTIVE_SQL =
  /\b(ALTER|CREATE|DELETE|DROP|GRANT|INSERT|REINDEX|REVOKE|TRUNCATE|UPDATE|VACUUM)\b/i;

function withoutTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;\s*$/, "").trim();
}

export function requiresDestructiveConfirmation(sql: string): boolean {
  return DESTRUCTIVE_SQL.test(sql);
}

export interface ProductionQuery {
  kind: "select" | "explain";
  sql: string;
}

export function validateProductionQuery(sql: string): ProductionQuery {
  const normalized = withoutTrailingSemicolon(sql);
  if (!normalized) throw new Error("Enter a SQL query");

  const explainMatch = normalized.match(
    /^EXPLAIN(?:\s*\([^)]*\))?\s+([\s\S]+)$/i,
  );
  const statement = explainMatch?.[1] || normalized;
  const ast = parse(statement);
  if (ast.length !== 1 || ast[0]?.type !== "select") {
    throw new Error("Production Studio accepts one SELECT or EXPLAIN SELECT");
  }
  return {
    kind: explainMatch ? "explain" : "select",
    sql: normalized,
  };
}

export function quoteIdentifier(identifier: string): string {
  if (!identifier || identifier.includes("\0")) {
    throw new Error("Invalid PostgreSQL identifier");
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}
