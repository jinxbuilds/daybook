import { NavLink } from "react-router-dom";
import { CalendarDays, CircleCheck, Hash, ListTodo, LogOut, Settings, Sun } from "lucide-react";

const NAV = [
  { to: "/today", label: "Today", icon: Sun, count: "today" },
  { to: "/upcoming", label: "Upcoming", icon: CalendarDays, count: "upcoming" },
  { to: "/all", label: "All tasks", icon: ListTodo, count: "all" },
  { to: "/done", label: "Done", icon: CircleCheck },
];

export default function Sidebar({ counts, user, onLogout, onNavigate, open }) {
  return (
    <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Main navigation">
      <p className="wordmark sidebar-mark">Daybook</p>
      <nav>
        <ul className="nav-list">
          {NAV.map(({ to, label, icon: Icon, count }) => (
            <li key={to}>
              <NavLink to={to} className="nav-link" onClick={onNavigate}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {count && counts[count] > 0 && (
                  <span className={`nav-count${count === "today" && counts.overdue ? " has-overdue" : ""}`}>
                    {counts[count]}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {counts.projects.length > 0 && (
          <>
            <h2 className="nav-heading">Projects</h2>
            <ul className="nav-list">
              {counts.projects.map(([name, n]) => (
                <li key={name}>
                  <NavLink to={`/project/${encodeURIComponent(name)}`} className="nav-link" onClick={onNavigate}>
                    <Hash size={16} aria-hidden="true" />
                    <span className="truncate">{name}</span>
                    {n > 0 && <span className="nav-count">{n}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="sidebar-foot">
        <NavLink to="/settings" className="nav-link" onClick={onNavigate}>
          <Settings size={18} aria-hidden="true" />
          <span className="truncate">{user.username}</span>
        </NavLink>
        <button className="nav-link nav-button" onClick={onLogout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
        <p className="shortcut-hint">
          <kbd>N</kbd> new task <kbd>/</kbd> search
        </p>
      </div>
    </aside>
  );
}
