import { memo } from "react";
import { Check, Repeat } from "lucide-react";
import { dueLabel, dueTone } from "../lib/dates.js";

const PRIORITY_NAME = { high: "High priority", medium: "Medium priority", low: "Low priority" };

function TaskRow({ task, now, onToggle, onOpen, showProject = true, showDue = true, selected }) {
  const tone = task.completed ? "" : dueTone(task.dueDate, now);
  return (
    <li className={`row${task.completed ? " is-done" : ""}${selected ? " is-selected" : ""}`}>
      <button
        className={`check check-${task.priority}${task.completed ? " is-checked" : ""}`}
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`${task.completed ? "Mark as not done" : "Complete"}: ${task.title}`}
        onClick={() => onToggle(task)}
      >
        <Check size={14} strokeWidth={3} aria-hidden="true" />
      </button>
      <button className="row-main" onClick={() => onOpen(task)} aria-label={`Edit ${task.title}`}>
        <span className="row-title">{task.title}</span>
        {task.notes && <span className="row-notes">{task.notes}</span>}
      </button>
      <span className="row-meta">
        {task.priority !== "none" && !task.completed && (
          <span className={`flag flag-${task.priority}`} title={PRIORITY_NAME[task.priority]}>
            <span className="sr-only">{PRIORITY_NAME[task.priority]}</span>
          </span>
        )}
        {task.repeat !== "none" && <Repeat size={14} aria-label={`Repeats ${task.repeat}`} className="muted" />}
        {showProject && task.project && <span className="chip chip-project">#{task.project}</span>}
        {showDue && task.dueDate && <span className={`chip chip-${tone || "plain"}`}>{dueLabel(task.dueDate, now)}</span>}
      </span>
    </li>
  );
}

export default memo(TaskRow);
