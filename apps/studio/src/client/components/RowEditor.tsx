import { FormEvent, useMemo, useState } from "react";
import type { RelationDetails } from "../../shared/types";

export function RowEditor({
  details,
  row,
  onCancel,
  onSave,
}: {
  details: RelationDetails;
  row: Record<string, unknown> | null;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const editableRow = useMemo(() => {
    if (!row) return {};
    return Object.fromEntries(
      Object.entries(row).filter(([key]) => !details.primaryKey.includes(key)),
    );
  }, [details.primaryKey, row]);
  const [value, setValue] = useState(() =>
    JSON.stringify(editableRow, null, 2),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Enter a JSON object with column values");
      }
      setSaving(true);
      await onSave(parsed as Record<string, unknown>);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save this row",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal"
        onSubmit={submit}
        aria-labelledby="row-editor-title"
      >
        <p className="eyebrow">{row ? "Edit local row" : "Add local row"}</p>
        <h2 id="row-editor-title">
          {details.relation.schema}.{details.relation.name}
        </h2>
        <p className="muted-copy">
          Use PostgreSQL-compatible JSON values. Omit generated columns to let
          their defaults run.
        </p>
        <textarea
          className="code-editor code-editor--compact"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="button-row button-row--end">
          <button
            className="button button--ghost"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save row"}
          </button>
        </div>
      </form>
    </div>
  );
}
