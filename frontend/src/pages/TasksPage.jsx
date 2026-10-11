import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { today, dueLabel, toYmd } from "../lib/dates.js";
import { buildView, counts as countTasks, VIEWS } from "../lib/views.js";
import { useToast } from "../components/Toasts.jsx";
import Sidebar from "../components/Sidebar.jsx";
import QuickAdd from "../components/QuickAdd.jsx";
import TaskRow from "../components/TaskRow.jsx";
import TaskEditor from "../components/TaskEditor.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";

const isTyping = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

// Keeps "today" correct if the tab stays open past midnight.
function useToday() {
  const [now, setNow] = useState(today());
  useEffect(() => {
    const id = setInterval(() => setNow(today()), 60_000);
    const onFocus = () => setNow(today());
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return now;
}

export default function TasksPage() {
  const { view = "today", project: rawProject } = useParams();
  const project = rawProject ? decodeURIComponent(rawProject) : null;
  const { user, logout, setUser } = useAuth();
  const toast = useToast();
  const now = useToday();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const quickAddRef = useRef(null);
  const searchRef = useRef(null);

  const isSettings = view === "settings";
  const validView = isSettings || project || VIEWS[view];

  const handleError = useCallback(
    (err) => {
      if (err.status === 401) {
        setUser(null);
        return;
      }
      toast(err.message, { tone: "error" });
    },
    [setUser, toast]
  );

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const d = await api("/tasks");
      setTasks(d.tasks);
    } catch (err) {
      if (err.status === 401) setUser(null);
      else setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    load();
  }, [load]);

  // Close the drawer/editor and clear search when the view changes.
  useEffect(() => {
    setNavOpen(false);
    setEditingId(null);
    setQuery("");
  }, [view, project]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (editingId) setEditingId(null);
        else if (navOpen) setNavOpen(false);
        else if (document.activeElement === searchRef.current) {
          setQuery("");
          searchRef.current.blur();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        quickAddRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, navOpen]);

  const replace = (id, next) => setTasks((ts) => ts.map((t) => (t.id === id ? next : t)));

  const addTask = useCallback(
    async (fields) => {
      try {
        const { task } = await api("/tasks", { method: "POST", body: fields });
        setTasks((ts) => [task, ...ts]);
        const visible = buildView({ view, project, tasks: [task], query: "", now }).groups.length > 0;
        if (!visible && !isSettings) {
          const label = dueLabel(task.dueDate, now);
          const msg = !task.dueDate
            ? "Added to All tasks"
            : /^(Today|Tomorrow|Yesterday)$/.test(label)
              ? `Added for ${label.toLowerCase()}`
              : `Added for ${label}`;
          toast(msg);
        }
        return true;
      } catch (err) {
        handleError(err);
        return false;
      }
    },
    [view, project, now, isSettings, toast, handleError]
  );

  const saveTask = useCallback(
    async (task, patch) => {
      replace(task.id, { ...task, ...patch });
      try {
        const d = await api(`/tasks/${task.id}`, { method: "PATCH", body: patch });
        replace(task.id, d.task);
        return true;
      } catch (err) {
        replace(task.id, task);
        handleError(err);
        return false;
      }
    },
    [handleError]
  );

  const toggleTask = useCallback(
    async (task) => {
      const completing = !task.completed;
      replace(task.id, { ...task, completed: completing, completedAt: completing ? new Date().toISOString() : null });
      try {
        const d = await api(`/tasks/${task.id}`, { method: "PATCH", body: { completed: completing } });
        setTasks((ts) => {
          const updated = ts.map((t) => (t.id === task.id ? d.task : t));
          return d.next ? [d.next, ...updated] : updated;
        });
        if (completing) {
          const undo = async () => {
            try {
              if (d.next) {
                await api(`/tasks/${d.next.id}`, { method: "DELETE" });
                setTasks((ts) => ts.filter((t) => t.id !== d.next.id));
              }
              const body = { completed: false, ...(d.next ? { repeat: task.repeat } : {}) };
              const r = await api(`/tasks/${task.id}`, { method: "PATCH", body });
              replace(task.id, r.task);
            } catch (err) {
              handleError(err);
            }
          };
          const msg = d.next ? `Done. Next one ${dueLabel(d.next.dueDate, now).toLowerCase()}` : `Completed \u201c${task.title}\u201d`;
          toast(msg, { action: { label: "Undo", onClick: undo } });
        }
      } catch (err) {
        replace(task.id, task);
        handleError(err);
      }
    },
    [handleError, toast, now]
  );

  const deleteTask = useCallback(
    async (task) => {
      setEditingId(null);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
      try {
        await api(`/tasks/${task.id}`, { method: "DELETE" });
        const undo = async () => {
          try {
            const { title, notes, dueDate, priority, project: p, repeat } = task;
            let { task: restored } = await api("/tasks", {
              method: "POST",
              body: { title, notes, dueDate, priority, project: p, repeat },
            });
            if (task.completed) {
              restored = (await api(`/tasks/${restored.id}`, { method: "PATCH", body: { completed: true } })).task;
            }
            setTasks((ts) => [restored, ...ts]);
          } catch (err) {
            handleError(err);
          }
        };
        toast(`Deleted \u201c${task.title}\u201d`, { action: { label: "Undo", onClick: undo } });
      } catch (err) {
        setTasks((ts) => [task, ...ts]);
        handleError(err);
      }
    },
    [handleError, toast]
  );

  const clearCompleted = async () => {
    const n = tasks.filter((t) => t.completed).length;
    if (!window.confirm(`Permanently delete ${n} completed ${n === 1 ? "task" : "tasks"}?`)) return;
    try {
      await api("/tasks/clear-completed", { method: "POST" });
      setTasks((ts) => ts.filter((t) => !t.completed));
      toast("Completed tasks cleared");
    } catch (err) {
      handleError(err);
    }
  };

  const tally = useMemo(() => countTasks(tasks, now), [tasks, now]);
  const model = useMemo(
    () => (isSettings || !validView ? null : buildView({ view, project, tasks, query, now })),
    [view, project, tasks, query, now, isSettings, validView]
  );
  const editing = editingId ? tasks.find((t) => t.id === editingId) : null;
  const defaults = { dueDate: view === "today" && !project ? now : null, project: project || "" };
  const doneToday = tasks.filter((t) => t.completed && t.completedAt && toYmd(new Date(t.completedAt)) === now).length;

  if (!validView) return <Navigate to="/today" replace />;

  return (
    <div className="shell">
      <Sidebar
        counts={tally}
        user={user}
        open={navOpen}
        onNavigate={() => setNavOpen(false)}
        onLogout={logout}
      />
      {navOpen && <button className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}

      <main className="page" id="main">
        <header className="page-head">
          <button className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="page-titles">
            <h1 className="page-title">{isSettings ? "Settings" : model.title}</h1>
            {model?.subtitle && (
              <p className="page-subtitle">
                {model.subtitle}
                {doneToday > 0 && <span className="done-today">{doneToday} done so far</span>}
              </p>
            )}
          </div>
          {!isSettings && (
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search tasks</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
              />
              {query && (
                <button className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              )}
            </label>
          )}
        </header>

        {isSettings ? (
          <SettingsPanel />
        ) : (
          <>
            {view !== "done" && <QuickAdd ref={quickAddRef} onAdd={addTask} defaults={defaults} now={now} />}

            {loading ? (
              <div className="rows rows-loading" aria-busy="true" aria-label="Loading tasks" />
            ) : loadError ? (
              <div className="empty">
                <p className="empty-title">Couldn't load your tasks</p>
                <p className="muted">{loadError}</p>
                <button className="btn btn-secondary" onClick={load}>Try again</button>
              </div>
            ) : model.groups.length === 0 ? (
              <div className="empty">
                <p className="empty-title">{model.empty.title}</p>
                <p className="muted">{model.empty.body}</p>
              </div>
            ) : (
              <div className="groups">
                {model.groups.map((g) => (
                  <section key={g.key} className={`group${g.tone ? ` group-${g.tone}` : ""}`} aria-labelledby={`g-${g.key}`}>
                    <h2
                      className={`group-title${model.groups.length === 1 && g.label === model.title ? " sr-only" : ""}`}
                      id={`g-${g.key}`}
                    >
                      {g.label}
                      {g.sub && g.sub !== g.label && <span className="group-sub">{g.sub}</span>}
                      <span className="group-count">{g.tasks.length}</span>
                    </h2>
                    <ul className="rows">
                      {g.tasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          now={now}
                          onToggle={toggleTask}
                          onOpen={(task) => setEditingId(task.id)}
                          showProject={!project}
                          showDue={!g.hideDue}
                          selected={t.id === editingId}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {view === "done" && (
                  <div className="page-foot">
                    <button className="btn btn-danger-quiet" onClick={clearCompleted}>Clear completed</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {editing && (
        <TaskEditor
          task={editing}
          projects={tally.projects}
          now={now}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
