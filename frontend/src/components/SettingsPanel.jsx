import { useState } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { applyTheme, getTheme } from "../lib/theme.js";
import { useToast } from "./Toasts.jsx";

function Section({ title, children, description }) {
  return (
    <section className="settings-section">
      <div className="settings-label">
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="settings-body">{children}</div>
    </section>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.username);
  const { busy, error, run } = useAction();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const d = await api("/account/profile", { method: "PATCH", body: { username: name } });
          setUser(d.user);
          toast("Name saved");
        });
      }}
    >
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      </label>
      <p className="muted">Signed in as {user.email}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button className="btn btn-secondary" disabled={busy || name.trim() === user.username || !name.trim()}>
          Save name
        </button>
      </div>
    </form>
  );
}

function Appearance() {
  const [theme, setTheme] = useState(getTheme());
  const choose = (t) => {
    setTheme(t);
    applyTheme(t);
  };
  return (
    <div className="segmented" role="radiogroup" aria-label="Theme">
      {[
        ["system", "Match device"],
        ["light", "Light"],
        ["dark", "Dark"],
      ].map(([v, l]) => (
        <label key={v} className="segment">
          <input type="radio" name="theme" checked={theme === v} onChange={() => choose(v)} />
          <span>{l}</span>
        </label>
      ))}
    </div>
  );
}

function TwoFactor() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [stage, setStage] = useState("idle"); // idle | setup | codes | disable
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState([]);
  const { busy, error, run, setError } = useAction();

  const reset = () => {
    setStage("idle");
    setCode("");
    setPassword("");
    setError("");
  };

  if (stage === "codes") {
    return (
      <div className="stack">
        <p>
          <strong>Save these recovery codes somewhere safe.</strong> Each one signs you in once if you lose your phone.
          You won't see them again.
        </p>
        <ul className="recovery-codes">
          {recovery.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
        <div className="row-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard?.writeText(recovery.join("\n")).then(() => toast("Codes copied"))}
          >
            <Copy size={16} aria-hidden="true" /> Copy codes
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setRecovery([]);
              reset();
            }}
          >
            I've saved them
          </button>
        </div>
      </div>
    );
  }

  if (user.mfaEnabled) {
    if (stage !== "disable") {
      return (
        <div className="stack">
          <p className="status-on">
            <ShieldCheck size={18} aria-hidden="true" /> On. Signing in needs your password and a code from your app.
          </p>
          <div>
            <button className="btn btn-secondary" onClick={() => setStage("disable")}>
              Turn off two-factor
            </button>
          </div>
        </div>
      );
    }
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const d = await api("/account/mfa/disable", { method: "POST", body: { password, code } });
            setUser(d.user);
            toast("Two-factor sign-in turned off");
            reset();
          });
        }}
      >
        <label className="field">
          <span>Current password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>Code from your app, or a recovery code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required maxLength={20} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-danger" disabled={busy}>Turn off</button>
          <button type="button" className="btn btn-quiet" onClick={reset}>Cancel</button>
        </div>
      </form>
    );
  }

  if (stage === "setup" && setup) {
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const d = await api("/account/mfa/enable", { method: "POST", body: { code } });
            setUser(d.user);
            setRecovery(d.recoveryCodes);
            setStage("codes");
            setCode("");
          });
        }}
      >
        <ol className="steps">
          <li>Scan this with an authenticator app (1Password, Google Authenticator, Authy, Microsoft Authenticator).</li>
          <li>Enter the 6-digit code it shows.</li>
        </ol>
        <img className="qr" src={setup.qrDataUrl} alt="QR code for your authenticator app" width="180" height="180" />
        <p className="muted small">
          Can't scan? Enter this key manually: <code className="secret">{setup.secret}</code>
        </p>
        <label className="field">
          <span>6-digit code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>Turn on</button>
          <button type="button" className="btn btn-quiet" onClick={reset}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="stack">
      <p>Off. Add a code from your phone at sign-in so a leaked password isn't enough to get in.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              setSetup(await api("/account/mfa/setup", { method: "POST" }));
              setStage("setup");
            })
          }
        >
          Set up two-factor
        </button>
      </div>
    </div>
  );
}

function Password() {
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const { busy, error, run } = useAction();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/account/password", { method: "POST", body: f });
          setF({ currentPassword: "", newPassword: "" });
          toast("Password changed. Other devices were signed out.");
        });
      }}
    >
      <label className="field">
        <span>Current password</span>
        <input type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>New password</span>
        <input type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" minLength={8} required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button className="btn btn-secondary" disabled={busy}>Change password</button>
      </div>
    </form>
  );
}

function Sessions() {
  const { setUser } = useAuth();
  const { busy, error, run } = useAction();
  return (
    <div className="stack">
      <p>Signs you out here and on every other browser and phone.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("/account/logout-everywhere", { method: "POST" });
              setUser(null);
            })
          }
        >
          Sign out everywhere
        </button>
      </div>
    </div>
  );
}

function DeleteAccount() {
  const { setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  if (!open) {
    return (
      <div className="stack">
        <p>Permanently deletes your account and every task. This can't be undone.</p>
        <div>
          <button className="btn btn-danger-quiet" onClick={() => setOpen(true)}>Delete account</button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/account", { method: "DELETE", body: { password } });
          setUser(null);
        });
      }}
    >
      <label className="field">
        <span>Enter your password to confirm</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button className="btn btn-danger" disabled={busy || !password}>Delete my account and tasks</button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export default function SettingsPanel() {
  return (
    <div className="settings">
      <Section title="Profile"><Profile /></Section>
      <Section title="Appearance"><Appearance /></Section>
      <Section title="Two-factor sign-in" description="Uses an authenticator app on your phone."><TwoFactor /></Section>
      <Section title="Password"><Password /></Section>
      <Section title="Sessions"><Sessions /></Section>
      <Section title="Delete account"><DeleteAccount /></Section>
    </div>
  );
}
