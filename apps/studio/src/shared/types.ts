export type StudioProfile = "local" | "production";

export interface StudioSession {
  profile: StudioProfile;
  csrfToken: string;
  readOnly: boolean;
}

export interface ConnectionOverview {
  profile: StudioProfile;
  database: string;
  user: string;
  version: string;
  latencyMs: number;
  readOnly: boolean;
  tableCount: number;
  viewCount: number;
  migrationCount: number;
  latestMigration: string | null;
}

export type RelationKind = "table" | "view";

export interface RelationSummary {
  schema: string;
  name: string;
  kind: RelationKind;
  estimatedRows: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  foreignKey: string | null;
  sensitive: boolean;
}

export interface IndexInfo {
  name: string;
  definition: string;
}

export interface ConstraintInfo {
  name: string;
  type: string;
  definition: string;
}

export interface RelationDetails {
  relation: RelationSummary;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  editable: boolean;
  primaryKey: string[];
}

export interface RowsResponse {
  rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface QueryResponse {
  command: string;
  fields: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  requiresRawDataWarning: boolean;
}

export interface ApiErrorShape {
  error: { code: string; message: string };
}
