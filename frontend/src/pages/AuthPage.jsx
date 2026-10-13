import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { DEMO } from "../lib/api.js";

const SAMPLE = [
  { title: "Call the dentist", meta: ["Tomorrow", "#health"], flag: "high" },
  { title: "Pay rent", meta: ["Friday", "#home", "monthly"], flag: "none" },
  { title: "Stand-up notes", meta: ["Today", "#work", "weekdays"], flag: "medium", today: true },
];

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function enterDemo() {
    setError("");
    setBusy(true);
    try {
      await login("demo@daybook.app", "demo");
      navigate("/today");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) {
        await register({ email: form.email, username: form.username, password: form.password });
        navigate("/today");
      } else {
        const r = await login(form.email, form.password, needsCode ? form.code : undefined);
        if (r.mfaRequired) setNeedsCode(true);
        else navigate("/today");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-intro">
        <p className="wordmark">Daybook</p>
        <h1 className="auth-title">Today's tasks on one page. Everything else waits its turn.</h1>
        <p className="auth-lede">
          Type a task the way you'd say it. Daybook picks out the date, priority, project and repeat, so adding
          something takes a second.
        </p>
        <div className="sample" aria-hidden="true">
          <div className="sample-input">
            Call the dentist <mark>tomorrow</mark> <mark>!high</mark> <mark>#health</mark>
          </div>
          <ul className="sample-rows">
            {SAMPLE.map((t) => (
              <li key={t.title} className="sample-row">
                <span className={`check check-${t.flag}`} />
                <span className="sample-title">{t.title}</span>
                <span className="sample-meta">
                  {t.meta.map((m, i) => (
                    <span key={m} className={i === 0 && t.today ? "chip chip-today" : "chip"}>
                      {m}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate>
          <h2>{needsCode ? "Enter your code" : isSignup ? "Create your account" : "Sign in"}</h2>

          {DEMO && !needsCode && (
            <div className="demo-entry">
              <p className="muted">
                This is a demo. No account is needed, and your tasks stay in this browser. Any email and password also work.
              </p>
              <button type="button" className="btn btn-primary btn-block" onClick={enterDemo} disabled={busy}>
                Enter the demo
              </button>
              <p className="demo-or" aria-hidden="true">
                or
              </p>
            </div>
          )}

          {needsCode ? (
            <>
              <p className="muted">Open your authenticator app and enter the 6-digit code, or use a recovery code.</p>
              <label className="field">
                <span>Code</span>
                <input
                  name="code"
                  value={form.code}
                  onChange={set}
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  maxLength={20}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" value={form.email} onChange={set} autoComplete="email" required autoFocus />
              </label>
              {isSignup && (
                <label className="field">
                  <span>Your name</span>
                  <input name="username" value={form.username} onChange={set} autoComplete="nickname" required maxLength={40} />
                </label>
              )}
              <label className="field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={set}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={isSignup ? 8 : undefined}
                />
                {isSignup && <small className="hint">At least 8 characters. A short phrase works well.</small>}
              </label>
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "One moment…" : needsCode ? "Verify and sign in" : isSignup ? "Create account" : "Sign in"}
          </button>

          {needsCode ? (
            <button type="button" className="btn btn-quiet btn-block" onClick={() => setNeedsCode(false)}>
              Use a different account
            </button>
          ) : (
            <p className="auth-switch">
              {isSignup ? (
                <>
                  Already have an account? <Link to="/signin">Sign in</Link>
                </>
              ) : (
                <>
                  New here? <Link to="/signup">Create an account</Link>
                </>
              )}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
