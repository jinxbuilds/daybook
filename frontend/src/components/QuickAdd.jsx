import { forwardRef, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { parseQuickAdd } from "../lib/quickAdd.js";
import { dueLabel } from "../lib/dates.js";

const REPEAT_LABEL = { daily: "every day", weekdays: "weekdays", weekly: "every week", monthly: "every month" };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

const QuickAdd = forwardRef(function QuickAdd({ onAdd, defaults, now }, ref) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(text, now), [text, now]);

  const fields = {
    ...parsed,
    dueDate: parsed.dueDate ?? defaults.dueDate ?? null,
    project: parsed.project || defaults.project || "",
  };
  const chips = [
    fields.dueDate && { key: "due", label: dueLabel(fields.dueDate, now) },
    fields.priority !== "none" && { key: "p", label: PRIORITY_LABEL[fields.priority], tone: fields.priority },
    fields.project && { key: "proj", label: `#${fields.project}` },
    fields.repeat !== "none" && { key: "rep", label: REPEAT_LABEL[fields.repeat] },
  ].filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    if (!fields.title || busy) return;
    setBusy(true);
    const ok = await onAdd(fields);
    setBusy(false);
    if (ok) setText("");
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <label className="quick-add-field">
        <Plus size={20} aria-hidden="true" className="quick-add-icon" />
        <span className="sr-only">Add a task</span>
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task"
          maxLength={260}
          aria-describedby="quick-add-help"
          enterKeyHint="done"
        />
        {text.trim() && (
          <button className="btn btn-primary btn-small" disabled={busy || !fields.title}>
            Add task
          </button>
        )}
      </label>
      <div id="quick-add-help" className="quick-add-help">
        {text.trim() && chips.length > 0 ? (
          <span className="chips">
            {chips.map((c) => (
              <span key={c.key} className={`chip${c.tone ? ` chip-${c.tone}` : ""}`}>
                {c.label}
              </span>
            ))}
          </span>
        ) : (
          <span className="muted">
            Try <q>Pay rent friday !high #home every month</q>
          </span>
        )}
      </div>
    </form>
  );
});

export default QuickAdd;
