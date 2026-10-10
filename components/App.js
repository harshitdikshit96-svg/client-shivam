"use client";
import { useCallback, useEffect, useState } from "react";
import { CustProvider, Toolbar, useCust } from "./Cust";
import Sidebar from "./Sidebar";
import PageView from "./PageView";
import { APP_TITLE, SCREEN_BY_ID } from "@/lib/schema";

const readScreen = () => {
  const m = typeof window !== "undefined" && window.location.hash.match(/s=([\w-]+)/);
  return m && SCREEN_BY_ID[m[1]] ? m[1] : "home";
};

export default function App() {
  const [k, setK] = useState(null);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
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
      <Shell />
    </CustProvider>
  );
}

function Shell() {
  const c = useCust();
  const [screen, setScreen] = useState("home");
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    setScreen(readScreen());
    const onHash = () => setScreen(readScreen());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    if (!SCREEN_BY_ID[id]) return;
    window.location.hash = `s=${id}`;
    setScreen(id);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className={`app ${c.customizing ? "customizing" : ""}`}>
      <Toolbar screen={screen} onJump={go} />
      {c.locked && (
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
        <button className="btn btn-outline-danger btn-sm">Logout</button>
      </header>
      <div className="body">
        <Sidebar screen={screen} go={go} />
        <main className="main">
          <PageView key={screen} screen={SCREEN_BY_ID[screen]} go={go} />
        </main>
      </div>
    </div>
  );
}
