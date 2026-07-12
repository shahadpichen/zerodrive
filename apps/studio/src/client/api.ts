import type {
  ApiErrorShape,
  ConnectionOverview,
  QueryResponse,
  RelationDetails,
  RelationSummary,
  RowsResponse,
  StudioSession,
} from "../shared/types";

export class StudioApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let csrfToken = "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && method !== "HEAD"
        ? { "X-Studio-CSRF": csrfToken }
        : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({
      error: { code: "REQUEST_FAILED", message: "Studio request failed" },
    }))) as ApiErrorShape;
    throw new StudioApiError(
      payload.error.message,
      payload.error.code,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function loadSession(): Promise<StudioSession> {
  const session = await request<StudioSession>("/api/session");
  csrfToken = session.csrfToken;
  return session;
}

export const studioApi = {
  overview: () => request<ConnectionOverview>("/api/overview"),
  relations: () => request<RelationSummary[]>("/api/relations"),
  relation: (schema: string, name: string) =>
    request<RelationDetails>(
      `/api/relations/${encodeURIComponent(schema)}/${encodeURIComponent(name)}`,
    ),
  rows: (
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
  ) => {
    const query = new URLSearchParams({
      offset: String(options.offset),
      limit: String(options.limit),
    });
    if (options.sort) query.set("sort", options.sort);
    if (options.direction) query.set("direction", options.direction);
    if (options.filterColumn) query.set("filterColumn", options.filterColumn);
    if (options.filterValue !== undefined)
      query.set("filterValue", options.filterValue);
    return request<RowsResponse>(
      `/api/relations/${encodeURIComponent(schema)}/${encodeURIComponent(name)}/rows?${query}`,
    );
  },
  insertRow: (schema: string, name: string, values: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/api/relations/${encodeURIComponent(schema)}/${encodeURIComponent(name)}/rows`,
      { method: "POST", body: JSON.stringify({ values }) },
    ),
  updateRow: (
    schema: string,
    name: string,
    primaryKey: Record<string, unknown>,
    values: Record<string, unknown>,
  ) =>
    request<Record<string, unknown>>(
      `/api/relations/${encodeURIComponent(schema)}/${encodeURIComponent(name)}/rows`,
      { method: "PATCH", body: JSON.stringify({ primaryKey, values }) },
    ),
  deleteRow: (
    schema: string,
    name: string,
    primaryKey: Record<string, unknown>,
  ) =>
    request<void>(
      `/api/relations/${encodeURIComponent(schema)}/${encodeURIComponent(name)}/rows`,
      {
        method: "DELETE",
        body: JSON.stringify({ primaryKey }),
      },
    ),
  query: (sql: string, confirmDestructive = false) =>
    request<QueryResponse>("/api/query", {
      method: "POST",
      body: JSON.stringify({ sql, confirmDestructive }),
    }),
};
