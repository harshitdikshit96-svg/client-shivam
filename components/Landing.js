"use client";
// Full-screen home page shown when nobody is logged in: what the portal is for, and the login.
import { useState } from "react";
import { APP_TITLE } from "@/lib/schema";

const FEATURES = [
  ["Work orders", "Every contract of every firm, with its wage Config, approval and status."],
  ["Workmen", "Profiles, engagements on work orders, and who is active, inactive or moved out."],
  ["Wages", "Days worked in, wages, EPF and ESI out — calculated, submitted and approved by month."],
  ["Compliance", "Bills in the Dispatch Register with GST, EPF and ESIC payment status."],
];

export default function Landing({ hasLogin, onLoggedIn, notice }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error || "Could not log in. Please try again.");
        setFields(body.fields ?? {});
        if (body.fields?.password) setPassword("");
        return;
      }
      onLoggedIn(body);
    } catch {
      setError("The server did not answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing-head">
        <span className="logo" aria-hidden>CP</span>
        <span className="landing-title">{APP_TITLE}</span>
      </header>
      <main className="landing-main">
        <section className="landing-intro">
          <h1>All your firms, work orders, workmen and wages in one place.</h1>
          <p>Create, view and correct contract-labour records, calculate wages from the days worked, and keep compliance in step.</p>
          <ul className="landing-features">
            {FEATURES.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}
          </ul>
        </section>
        <section className="landing-card" aria-label="Log in">
          <h2>Log in</h2>
          {notice && <div className="notice notice-info" role="status">{notice}</div>}
          {!hasLogin ? (
            <div className="notice notice-info" role="status">
              No login has been set up yet. Your administrator sets it up once on the server with
              <code> npm run db:login</code>.
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {error && <div className="notice notice-error" role="alert">{error}</div>}
              <label className={`field ${fields.username ? "has-error" : ""}`}>
                <span>Username</span>
                <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} autoFocus aria-invalid={fields.username ? true : undefined} />
              </label>
              <label className={`field ${fields.password ? "has-error" : ""}`}>
                <span>Password</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} aria-invalid={fields.password ? true : undefined} />
              </label>
              <button className="btn btn-primary w100" type="submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
              <button type="button" className="link-btn forgot" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>Forgot password?</button>
              {forgot && (
                <p className="small-note forgot-text">
                  For safety a forgotten password can only be reset by your administrator, on the server
                  (<code>npm run db:login</code>). Once you are logged in you can change your password any time under
                  Compliance → Reset Password.
                </p>
              )}
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
