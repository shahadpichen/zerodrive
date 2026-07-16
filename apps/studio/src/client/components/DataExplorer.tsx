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
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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
  const [deleteCandidate, setDeleteCandidate] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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

  const primaryKeyLabel = (row: Record<string, unknown>) => {
    const key = primaryKeyFor(row);
    return Object.keys(key).length ? JSON.stringify(key) : "selected row";
  };

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

  const confirmDelete = async () => {
    if (!selected || !deleteCandidate) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await studioApi.deleteRow(
        selected.schema,
        selected.name,
        primaryKeyFor(deleteCandidate),
      );
      setDeleteCandidate(null);
      await load();
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "Unable to delete this row",
      );
    } finally {
      setDeleting(false);
    }
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
                <Button variant="outline" onClick={() => void load()}>
                  Refresh
                </Button>
                {details?.editable && (
                  <Button onClick={() => setEditorRow(null)}>Add row</Button>
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
              <Label className="toolbar-field">
                Filter column
                <Select
                  value={filterColumn || "__none"}
                  onValueChange={(value) =>
                    setFilterColumn(value === "__none" ? "" : value)
                  }
                >
                  <SelectTrigger className="toolbar-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {details?.columns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label className="toolbar-field">
                Contains
                <Input
                  className="toolbar-control"
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  disabled={!filterColumn}
                />
              </Label>
              <Button
                size="sm"
                className="toolbar-button"
                onClick={() => {
                  setOffset(0);
                  setAppliedFilter({
                    column: filterColumn,
                    value: filterValue,
                  });
                }}
              >
                Apply filter
              </Button>
              <span className="toolbar-spacer" />
              <Label className="toolbar-field">
                Sort
                <Select
                  value={sort || "__default"}
                  onValueChange={(value) => {
                    setSort(value === "__default" ? "" : value);
                    setOffset(0);
                  }}
                >
                  <SelectTrigger className="toolbar-control">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Default</SelectItem>
                    {details?.columns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="direction-button"
                onClick={() =>
                  setDirection(direction === "asc" ? "desc" : "asc")
                }
              >
                {direction.toUpperCase()}
              </Button>
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
                              onClick={() => {
                                setDeleteError("");
                                setDeleteCandidate(row);
                              }}
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data?.hasMore}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </Button>
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
      {deleteCandidate && details && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-row-title"
          >
            <p className="eyebrow">Delete local row</p>
            <h2 id="delete-row-title">
              {details.relation.schema}.{details.relation.name}
            </h2>
            <p className="muted-copy">
              This will permanently delete the row identified by:
            </p>
            <pre className="row-key-preview">
              {primaryKeyLabel(deleteCandidate)}
            </pre>
            <p className="muted-copy">
              This action cannot be undone. Production Studio remains read-only,
              so this confirmation is only available in local mode.
            </p>
            {deleteError && <p className="form-error">{deleteError}</p>}
            <div className="button-row button-row--end">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete row"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
