import { useState } from "react";
import type { QueryResponse, StudioProfile } from "../../shared/types";
import { StudioApiError, studioApi } from "../api";
import { StatusNotice } from "./StatusNotice";

export function QueryWorkspace({ profile }: { profile: StudioProfile }) {
  const [sql, setSql] = useState(
    "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 20;",
  );
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const execute = async (confirmDestructive = false) => {
    setRunning(true);
    setError("");
    try {
      setResult(await studioApi.query(sql, confirmDestructive));
    } catch (caught) {
      if (
        caught instanceof StudioApiError &&
        caught.code === "CONFIRM_DESTRUCTIVE"
      ) {
        if (
          window.confirm(
            "This statement can change your local database. Execute it anyway?",
          )
        ) {
          setRunning(false);
          await execute(true);
          return;
        }
      } else
        setError(caught instanceof Error ? caught.message : "Query failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="page-stack" aria-labelledby="query-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">SQL workspace</p>
          <h1 id="query-title">Ask PostgreSQL directly.</h1>
          <p>
            {profile === "production"
              ? "Production accepts one SELECT or EXPLAIN SELECT and runs it in a read-only transaction."
              : "Local mode permits full SQL. Destructive statements always require confirmation."}
          </p>
        </div>
        <button
          className="button"
          onClick={() => void execute()}
          disabled={running}
        >
          {running ? "Running…" : "Run query"}
        </button>
      </header>
      {profile === "production" && (
        <StatusNotice
          title="Raw query results can contain sensitive data"
          tone="warning"
        >
          The production role prevents writes, not reading. Review the selected
          fields before running a query.
        </StatusNotice>
      )}
      {error && (
        <StatusNotice title="Query failed" tone="danger">
          {error}
        </StatusNotice>
      )}
      <textarea
        className="code-editor"
        value={sql}
        onChange={(event) => setSql(event.target.value)}
        spellCheck={false}
        aria-label="SQL query"
      />
      {result && (
        <div className="query-results">
          <div className="result-meta">
            <span>{result.command}</span>
            <span>
              {result.rowCount} rows · {result.durationMs} ms
              {result.truncated ? " · truncated" : ""}
            </span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {result.fields.map((field) => (
                    <th key={field}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr key={index}>
                    {result.fields.map((field) => (
                      <td key={field}>
                        {row[field] === null
                          ? "NULL"
                          : typeof row[field] === "object"
                            ? JSON.stringify(row[field])
                            : String(row[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
