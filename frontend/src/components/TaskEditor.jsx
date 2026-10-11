import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { addDays } from "../lib/dates.js";

const PRIORITIES = [
  ["none", "None"],
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];
const REPEATS = [
  ["none", "Doesn't repeat"],
  ["daily", "Every day"],
  ["weekdays", "Every weekday"],
  ["weekly", "Every week"],
  ["monthly", "Every month"],
];

export default function TaskEditor({ task, projects, now, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState("");
  const titleRef = useRef(null);

  useEffect(() => {
    setDraft(task);
    setError("");
  }, [task]);
  useEffect(() => titleRef.current?.focus(), [task.id]);

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = ["title", "notes", "dueDate", "priority", "project", "repeat"].some((k) => draft[k] !== task[k]);

  async function save(e) {
    e?.preventDefault();
    if (!draft.title.trim()) return setError("Give the task a title.");
    if (draft.repeat !== "none" && !draft.dueDate) return setError("Repeating tasks need a due date.");
    const patch = {};
    for (const k of ["title", "notes", "dueDate", "priority", "project", "repeat"]) {
      if (draft[k] !== task[k]) patch[k] = k === "title" || k === "project" ? draft[k].trim() : draft[k];
    }
    if (Object.keys(patch).length === 0) return onClose();
    const ok = await onSave(task, patch);
    if (ok) onClose();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e);
  }

  return (
    <div className="editor-layer" onKeyDown={onKeyDown}>
      <button className="editor-scrim" aria-label="Close editor" tabIndex={-1} onClick={onClose} />
      <form className="editor" onSubmit={save} aria-label="Edit task">
        <div className="editor-head">
          <h2>Edit task</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <label className="field">
          <span>Title</span>
          <input ref={titleRef} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={5} maxLength={5000} />
        </label>

        <div className="field">
          <label htmlFor="due">Due date</label>
          <input id="due" type="date" value={draft.dueDate || ""} onChange={(e) => set("dueDate", e.target.value || null)} />
          <div className="quick-dates">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => set("dueDate", now)}>Today</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => set("dueDate", addDays(now, 1))}>Tomorrow</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => set("dueDate", addDays(now, 7))}>Next week</button>
            {draft.dueDate && (
              <button type="button" className="btn btn-quiet btn-small" onClick={() => set("dueDate", null)}>No date</button>
            )}
          </div>
        </div>

        <fieldset className="field">
          <legend>Priority</legend>
          <div className="segmented">
            {PRIORITIES.map(([value, label]) => (
              <label key={value} className={`segment segment-${value}`}>
                <input type="radio" name="priority" value={value} checked={draft.priority === value} onChange={() => set("priority", value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span>Project</span>
            <input list="project-options" value={draft.project} onChange={(e) => set("project", e.target.value)} maxLength={40} placeholder="None" />
            <datalist id="project-options">
              {projects.map(([p]) => <option key={p} value={p} />)}
            </datalist>
          </label>
          <label className="field">
            <span>Repeat</span>
            <select value={draft.repeat} onChange={(e) => set("repeat", e.target.value)}>
              {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="editor-actions">
          <button className="btn btn-primary" disabled={!dirty}>Save changes</button>
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger-quiet editor-delete" onClick={() => onDelete(task)}>
            <Trash2 size={16} aria-hidden="true" /> Delete
          </button>
        </div>
      </form>
    </div>
  );
}
