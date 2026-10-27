"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustProvider, Toolbar, useCust } from "./Cust";
import Sidebar from "./Sidebar";
import PageView from "./PageView";
import { APP_TITLE, HEADER, SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";
import { DataProvider, useData } from "./Data";
import Landing from "./Landing";
import ErrorBoundary from "./ErrorBoundary";

// "final"     = the client's frozen spec (v1, 12 Oct 2026) baked into lib/schema.js; no customize layer.
// "prototype" = the old field-selection tool (needs ?k=CLIENT_TOKEN, autosave, Submit final).
export const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE === "prototype" ? "prototype" : "final";

// Location lives in the hash: #s=wo_view&wo=3 → screen "wo_view", params { wo: "3" }
const readLocation = () => {
  if (typeof window === "undefined") return { screen: "home", params: {} };
  const q = new URLSearchParams(window.location.hash.slice(1));
  const screen = q.get("s");
  q.delete("s");
  return SCREEN_BY_ID[screen] ? { screen, params: Object.fromEntries(q) } : { screen: "home", params: {} };
};
const writeHash = (screen, params) => {
  const q = new URLSearchParams({ s: screen });
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== "") q.set(k, String(v));
  return q.toString();
};

export default function App() {
  const [k, setK] = useState(null);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (APP_MODE === "final") return setState({ data: { overrides: EMPTY, status: "final" } });
    const key = new URLSearchParams(window.location.search).get("k");
    setK(key);
    if (!key) return setState({ error: "This link is missing its access key." });
    fetch(`/api/config?k=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setState({ data: await r.json() }) : setState({ error: "This link is not valid. Please use the link shared with you." })))
      .catch(() => setState({ error: "Could not load. Check your connection and refresh." }));
  }, []);

  if (state.loading) return <div className="center-msg">Loading…</div>;
  if (state.error) return <div className="center-msg">{state.error}</div>;
  return (
    <CustProvider k={k} initial={state.data}>
      {APP_MODE === "final" ? <Session /> : <Shell />}
    </CustProvider>
  );
}

// Logged out → full-screen home page with the login. Logged in → the portal, opening on Home.
function Session() {
  const [auth, setAuth] = useState(null);   // { loggedIn, username, hasLogin, notice }

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        // a server-side fault (e.g. the database not set up) is shown as such, not as a connection problem
        setAuth(r.ok ? body : { loggedIn: false, hasLogin: true, notice: body.error ?? `The server had a problem (${r.status}). Please try again in a minute.` });
      })
      .catch(() => setAuth({ loggedIn: false, hasLogin: true, notice: "Could not reach the server. Check your connection and refresh." }));
  }, []);

  const showLanding = useCallback((notice) => {
    history.replaceState(null, "", window.location.pathname);   // the next login starts on Home
    setAuth((a) => ({ ...a, loggedIn: false, username: null, notice }));
  }, []);
  const logout = useCallback(async () => {
    try { await fetch("/api/session", { method: "DELETE" }); } catch { /* the session expires on its own */ }
    showLanding("You have logged out.");
  }, [showLanding]);

  if (!auth) return <div className="center-msg">Loading…</div>;
  if (!auth.loggedIn) {
    return <Landing hasLogin={auth.hasLogin} notice={auth.notice}
      onLoggedIn={(b) => { history.replaceState(null, "", window.location.pathname); setAuth({ ...auth, loggedIn: true, username: b.username, notice: null }); }} />;
  }
  return (
    <DataProvider onLoggedOut={() => showLanding("Your session has ended. Please log in again.")}>
      <Shell onLogout={logout} username={auth.username} />
    </DataProvider>
  );
}

function Shell({ onLogout, username }) {
  const c = useCust();
  const live = useData();
  const [loc, setLoc] = useState({ screen: "home", params: {} });
  const [showHelp, setShowHelp] = useState(true);
  const wrote = useRef(null);   // the hash go() just wrote; any other hash change is back/forward or a typed link
  const notify = live?.notify;

  useEffect(() => {
    setLoc(readLocation());
    const onHash = () => {
      if (window.location.hash.slice(1) !== wrote.current) notify?.(null);
      wrote.current = null;
      setLoc(readLocation());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [notify]);

  // go(screen, params, { keepNotice }) — the message of the last action is cleared unless it was just set for the new screen
  const go = useCallback((id, params = {}, opts = {}) => {
    if (id === "logout") return onLogout ? onLogout() : live?.notify("info", "Logout is not used in the field-selection prototype.");
    if (!SCREEN_BY_ID[id]) return;
    if (!opts.keepNotice) live?.notify(null);
    const hash = writeHash(id, params);
    if (window.location.hash.slice(1) !== hash) { wrote.current = hash; window.location.hash = hash; }
    setLoc({ screen: id, params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  }, [live, onLogout]);

  // every screen change starts at the top, however it was triggered
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc]);

  const switchFirm = async (id) => {
    await live.setFirm(id);
    // records of the previous firm are not valid any more: go back to the list the user was on
    const listOf = { wo_view: "wo_ongoing", wo_edit: "wo_ongoing", wo_config: "wo_ongoing", wm_view: "wm_active", wm_edit: "wm_active", wage_entry: "wage_new", wage_slip: "wage_slip" };
    go(listOf[loc.screen] ?? loc.screen, {});
    const name = live.data?.firms.find((f) => f.id === id)?.name;
    live.notify("info", `Now showing ${name ?? "the selected firm"}.`);
  };

  const screen = SCREEN_BY_ID[loc.screen];
  return (
    <div className={`app ${c.customizing ? "customizing" : ""}`}>
      {APP_MODE === "prototype" && <Toolbar screen={loc.screen} onJump={go} />}
      {APP_MODE === "prototype" && c.locked && (
        <div className="locked-bar">Your selection has been submitted and is now locked. Contact Harshit if you need another round of changes.</div>
      )}
      {c.customizing && showHelp && (
        <div className="help-bar">
          <span>
            <b>How to use:</b> ✕ hides a field, column, button or menu item · ✎ (or double-click) renames it · ◀ ▶ / ▲ ▼ or drag to reorder · 🔒 items are required by the system.
            Switch to <b>Preview</b> to see the result. Everything saves automatically; press <b>Submit final</b> when done.
          </span>
          <button className="link-btn" onClick={() => setShowHelp(false)}>Got it</button>
        </div>
      )}
      <header className="portal-head">
        <span className="logo" aria-hidden>CP</span>
        <span className="portal-title">{APP_TITLE}</span>
        <div className="head-actions">
          <label className="firm-switch">
            <span>{HEADER.firmSwitcher.label}</span>
            <select value={live?.firmId ?? ""} onChange={(e) => switchFirm(Number(e.target.value))} aria-label="Select firm" disabled={live && !live.data?.firms.length}>
              <option value="" disabled>{live?.data && !live.data.firms.length ? "— no firm yet —" : HEADER.firmSwitcher.placeholder}</option>
              {live?.data?.firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          {live?.firmId && <button className="btn btn-outline btn-sm" onClick={() => go("create_firm", { edit: 1 })}>Edit Firm</button>}
          {HEADER.actions.map((a) => (
            <button key={a.id} className="btn btn-primary btn-sm" onClick={() => go(a.to)}>{a.label}</button>
          ))}
          {username && <span className="who" title="Logged in">{username}</span>}
          <button className="btn btn-outline-danger btn-sm" onClick={() => go("logout")}>Logout</button>
        </div>
      </header>
      {live?.error && <div className="locked-bar err-bar" role="alert">{live.error}</div>}
      <div className="body">
        <Sidebar screen={loc.screen} go={go} />
        <main className="main">
          <ErrorBoundary key={`${loc.screen}|${JSON.stringify(loc.params)}`} onHome={() => go("home")}>
            <PageView key={`${loc.screen}|${JSON.stringify(loc.params)}|${live?.firmId ?? ""}`} screen={screen} go={go} params={loc.params} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
