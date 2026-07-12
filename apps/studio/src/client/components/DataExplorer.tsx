import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  RelationDetails,
  RelationSummary,
  RowsResponse,
  StudioProfile,
} from "../../shared/types";
import { studioApi } from "../api";
import { RowEditor } from "./RowEditor";
import { StatusNotice } from "./StatusNotice";

function displayValue(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataExplorer({
  relations,
  profile,
}: {
  relations: RelationSummary[];
  profile: StudioProfile;
}) {
  const [selected, setSelected] = useState<RelationSummary | null>(
    relations[0] || null,
  );
  const [details, setDetails] = useState<RelationDetails | null>(null);
  const [data, setData] = useState<RowsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({ column: "", value: "" });
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editorRow, setEditorRow] = useState<
    Record<string, unknown> | null | undefined
  >(undefined);
  const [revealed, setRevealed] = useState(() => new Set<string>());
  const grouped = useMemo(() => {
    const groups = new Map<string, RelationSummary[]>();
    relations.forEach((relation) =>
      groups.set(relation.schema, [
        ...(groups.get(relation.schema) || []),
        relation,
      ]),
    );
    return [...groups.entries()];
  }, [relations]);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const [nextDetails, nextData] = await Promise.all([
        studioApi.relation(selected.schema, selected.name),
        studioApi.rows(selected.schema, selected.name, {
          offset,
          limit: 50,
          sort: sort || undefined,
          direction,
          filterColumn: appliedFilter.column || undefined,
          filterValue: appliedFilter.column ? appliedFilter.value : undefined,
        }),
      ]);
      setDetails(nextDetails);
      setData(nextData);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load relation",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilter, direction, offset, selected, sort]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setOffset(0);
    setFilterColumn("");
    setFilterValue("");
    setAppliedFilter({ column: "", value: "" });
    setSort("");
    setRevealed(new Set());
  }, [selected]);

  const primaryKeyFor = (row: Record<string, unknown>) =>
    Object.fromEntries(
      (details?.primaryKey || []).map((key) => [key, row[key]]),
    );

  const saveRow = async (values: Record<string, unknown>) => {
    if (!selected || !details) return;
    if (editorRow)
      await studioApi.updateRow(
        selected.schema,
        selected.name,
        primaryKeyFor(editorRow),
        values,
      );
    else await studioApi.insertRow(selected.schema, selected.name, values);
    setEditorRow(undefined);
    await load();
  };

  const deleteRow = async (row: Record<string, unknown>) => {
    if (
      !selected ||
      !window.confirm("Delete this local row? This cannot be undone.")
    )
      return;
    await studioApi.deleteRow(
      selected.schema,
      selected.name,
      primaryKeyFor(row),
    );
    await load();
  };

  return (
    <section className="explorer" aria-label="Database explorer">
      <aside className="relation-sidebar">
        <div className="sidebar-heading">
          <p className="eyebrow">Database objects</p>
          <strong>{relations.length} relations</strong>
        </div>
        {grouped.map(([schema, items]) => (
          <div className="relation-group" key={schema}>
            <span>{schema}</span>
            {items.map((relation) => (
              <button
                className={
                  selected?.schema === relation.schema &&
                  selected.name === relation.name
                    ? "relation-link relation-link--active"
                    : "relation-link"
                }
                key={`${relation.schema}.${relation.name}`}
                onClick={() => setSelected(relation)}
              >
                <span>{relation.name}</span>
                <small>{relation.kind}</small>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="explorer-main">
        {!selected && (
          <StatusNotice title="No relations found">
            Run ZeroDrive migrations, then refresh Studio.
          </StatusNotice>
        )}
        {selected && (
          <>
            <header className="relation-header">
              <div>
                <p className="eyebrow">{selected.kind}</p>
                <h1>
                  {selected.schema}.{selected.name}
                </h1>
              </div>
              <div className="button-row">
                <button
                  className="button button--ghost"
                  onClick={() => void load()}
                >
                  Refresh
                </button>
                {details?.editable && (
                  <button className="button" onClick={() => setEditorRow(null)}>
                    Add row
                  </button>
                )}
              </div>
            </header>
            {profile === "production" && (
              <StatusNotice title="Production is read only" tone="warning">
                Sensitive fields are masked to reduce accidental exposure.
                Revealing a value does not change database permissions.
              </StatusNotice>
            )}
            {error && (
              <StatusNotice title="Could not load this relation" tone="danger">
                {error}
              </StatusNotice>
            )}

            <div className="toolbar">
              <label>
                Filter column
                <select
                  value={filterColumn}
                  onChange={(event) => setFilterColumn(event.target.value)}
                >
                  <option value="">None</option>
                  {details?.columns.map((column) => (
                    <option key={column.name}>{column.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Contains
                <input
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  disabled={!filterColumn}
                />
              </label>
              <button
                className="button button--small"
                onClick={() => {
                  setOffset(0);
                  setAppliedFilter({
                    column: filterColumn,
                    value: filterValue,
                  });
                }}
              >
                Apply filter
              </button>
              <span className="toolbar-spacer" />
              <label>
                Sort
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Default</option>
                  {details?.columns.map((column) => (
                    <option key={column.name}>{column.name}</option>
                  ))}
                </select>
              </label>
              <button
                className="direction-button"
                onClick={() =>
                  setDirection(direction === "asc" ? "desc" : "asc")
                }
              >
                {direction.toUpperCase()}
              </button>
            </div>

            <div className="data-table-wrap" aria-busy={loading}>
              <table className="data-table">
                <thead>
                  <tr>
                    {data?.columns.map((column) => (
                      <th key={column.name}>
                        <span>{column.name}</span>
                        <small>
                          {column.dataType}
                          {column.primaryKey ? " · PK" : ""}
                        </small>
                      </th>
                    ))}
                    {details?.editable && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {!loading && data?.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={(data.columns.length || 0) + 1}
                        className="empty-cell"
                      >
                        No rows match this view.
                      </td>
                    </tr>
                  )}
                  {data?.rows.map((row, rowIndex) => (
                    <tr key={JSON.stringify(primaryKeyFor(row)) || rowIndex}>
                      {data.columns.map((column) => {
                        const revealKey = `${rowIndex}:${column.name}`;
                        const masked =
                          profile === "production" &&
                          column.sensitive &&
                          !revealed.has(revealKey);
                        return (
                          <td
                            key={column.name}
                            className={
                              row[column.name] === null ? "null-cell" : ""
                            }
                          >
                            {masked ? (
                              <button
                                className="masked-value"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Reveal this sensitive value for the current session?",
                                    )
                                  )
                                    setRevealed(
                                      new Set(revealed).add(revealKey),
                                    );
                                }}
                              >
                                •••••• reveal
                              </button>
                            ) : (
                              <span title={displayValue(row[column.name])}>
                                {displayValue(row[column.name])}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      {details?.editable && (
                        <td>
                          <div className="row-actions">
                            <button onClick={() => setEditorRow(row)}>
                              Edit
                            </button>
                            <button
                              className="danger-link"
                              onClick={() => void deleteRow(row)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Rows {offset + 1}–{offset + (data?.rows.length || 0)}
              </span>
              <div className="button-row">
                <button
                  className="button button--small button--ghost"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </button>
                <button
                  className="button button--small button--ghost"
                  disabled={!data?.hasMore}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </button>
              </div>
            </div>

            {details && (
              <details className="schema-details">
                <summary>Schema details</summary>
                <div className="schema-grid">
                  <div>
                    <h3>Columns</h3>
                    {details.columns.map((column) => (
                      <p key={column.name}>
                        <strong>{column.name}</strong>
                        <span>
                          {column.dataType}
                          {column.nullable ? " · nullable" : " · required"}
                        </span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <h3>Indexes</h3>
                    {details.indexes.map((index) => (
                      <p key={index.name}>
                        <strong>{index.name}</strong>
                        <span>{index.definition}</span>
                      </p>
                    ))}
                    <h3>Constraints</h3>
                    {details.constraints.map((constraint) => (
                      <p key={constraint.name}>
                        <strong>{constraint.name}</strong>
                        <span>{constraint.definition}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </>
        )}
      </div>
      {editorRow !== undefined && details && (
        <RowEditor
          details={details}
          row={editorRow}
          onCancel={() => setEditorRow(undefined)}
          onSave={saveRow}
        />
      )}
    </section>
  );
}
