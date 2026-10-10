"use client";
import { useEffect, useMemo, useState } from "react";
import { buildSpec, finalSpec, diffVersions, EMPTY } from "@/lib/resolve";

const fmt = (t) => (t ? new Date(t).toLocaleString() : "—");

export default function Review() {
  const [a, setA] = useState(null);
  const [st, setSt] = useState({ loading: true });
  const [view, setView] = useState("summary");

  const load = (key) =>
    fetch(`/api/config?a=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setSt({ data: await r.json() }) : setSt({ error: "Invalid admin link." })))
      .catch(() => setSt({ error: "Could not load." }));

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("a");
    setA(key);
    if (!key) setSt({ error: "Missing admin key (?a=...)." });
    else load(key);
  }, []);

  const spec = useMemo(() => (st.data ? buildSpec(st.data.overrides) : null), [st.data]);
  const final = useMemo(() => (st.data ? finalSpec(st.data.overrides) : null), [st.data]);

  if (st.loading) return <div className="center-msg">Loading…</div>;
  if (st.error) return <div className="center-msg">{st.error}</div>;
  const d = st.data;
  const history = d.history || [];
  const events = d.events || [];

  const reopen = async () => {
    const note = prompt("Reopen for the client? Optional note for the log (e.g. 'asked to restore PAN field'):", "");
    if (note === null) return;
    await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, action: "reopen", note }) });
    load(a);
  };
  const save = (obj, name) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = name;
    el.click();
    URL.revokeObjectURL(url);
  };
  const download = () =>
    save({ status: d.status, submittedAt: d.submittedAt, version: history.length, spec: final, overrides: d.overrides },
      `client-shivam-spec-${(d.submittedAt || d.updatedAt || "draft").slice(0, 10)}.json`);
  const downloadVersion = (v) =>
    save({ version: v.version, submittedAt: v.submittedAt, spec: finalSpec(v.overrides), overrides: v.overrides },
      `client-shivam-spec-v${v.version}-${v.submittedAt.slice(0, 10)}.json`);

  const byScreen = (list) => {
    const out = {};
    for (const x of list) {
      const s = x.id.startsWith("menu.") ? "menu" : x.id.split(".")[0];
      (out[s] ||= []).push(x);
    }
    return out;
  };
  const titleOf = (s) => (s === "menu" ? "Sidebar menu" : spec.screens.find((x) => x.id === s)?.title || s);

  return (
    <div className="review">
      <header className="review-head">
        <div>
          <h1>Client field selection — review</h1>
          <p>
            Status: <b className={d.status === "submitted" ? "ok" : ""}>{d.status === "submitted" ? `Submitted v${history.length} (locked)` : history.length ? `Reopened — client editing after v${history.length}` : "Draft (client still editing)"}</b>
            {" · "}Last saved {fmt(d.updatedAt)}{d.submittedAt ? ` · Submitted ${fmt(d.submittedAt)}` : ""}
          </p>
        </div>
        <div className="review-actions">
          <button className="btn btn-light" onClick={() => load(a)}>Refresh</button>
          <button className="btn btn-primary" onClick={download}>Download spec (JSON)</button>
          {d.status === "submitted" && <button className="btn btn-outline" onClick={reopen}>Reopen for client</button>}
        </div>
      </header>

      <div className="stat-strip">
        <div><b>{spec.removed.length}</b> removed</div>
        <div><b>{spec.renamed.length}</b> renamed</div>
        <div><b>{spec.reordered.length}</b> lists reordered</div>
      </div>

      <div className="seg review-tabs">
        {["summary", "final", "history", "json"].map((v) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {v === "summary" ? "Changes" : v === "final" ? "Final field list" : v === "history" ? `History (${history.length})` : "Raw JSON"}
          </button>
        ))}
      </div>

      {view === "summary" && (
        <div className="review-grid">
          <section>
            <h2>Removed</h2>
            {spec.removed.length === 0 && <p className="muted">Nothing removed.</p>}
            {Object.entries(byScreen(spec.removed)).map(([s, list]) => (
              <div key={s} className="rv-group">
                <h3>{titleOf(s)}</h3>
                <ul>{list.map((x) => <li key={x.id}>{x.label} <code>{x.id}</code></li>)}</ul>
              </div>
            ))}
          </section>
          <section>
            <h2>Renamed</h2>
            {spec.renamed.length === 0 && <p className="muted">Nothing renamed.</p>}
            {Object.entries(byScreen(spec.renamed)).map(([s, list]) => (
              <div key={s} className="rv-group">
                <h3>{titleOf(s)}</h3>
                <ul>{list.map((x) => <li key={x.id}><s>{x.from}</s> → <b>{x.to}</b></li>)}</ul>
              </div>
            ))}
          </section>
        </div>
      )}

      {view === "final" && (
        <div className="final">
          <section className="rv-screen">
            <h2>Sidebar menu</h2>
            <ol>
              {final.menu.map((g) => (
                <li key={g.label}>{g.label}{g.items && <ol>{g.items.map((i) => <li key={i.label}>{i.label}</li>)}</ol>}</li>
              ))}
            </ol>
          </section>
          {final.screens.map((s) => (
            <section key={s.id} className="rv-screen">
              <h2>{s.title}</h2>
              {s.blocks.map((b, i) => (
                <div key={i} className="rv-block">
                  <h3>{b.title} <span className="muted">({b.type})</span></h3>
                  <ol>
                    {b.items.map((it, j) => (
                      <li key={j}>
                        {it.label}
                        {it.required && <span className="req"> *</span>}
                        {it.originalLabel && <span className="muted"> (was “{it.originalLabel}”)</span>}
                        {it.input && it.input !== "button" && <span className="muted"> · {it.input}</span>}
                        {it.calc && <span className="muted"> · calc: {it.calc}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {view === "history" && <History history={history} events={events} current={d} onDownload={downloadVersion} />}

      {view === "json" && <pre className="json">{JSON.stringify({ overrides: d.overrides, spec: final }, null, 2)}</pre>}
    </div>
  );
}

function History({ history, events, current, onDownload }) {
  if (!history.length) return <p className="muted">No submissions yet. Each time the client presses Submit final, a numbered version is saved here.</p>;
  const draftDiff = current.status !== "submitted" ? diffVersions(history[history.length - 1].overrides, current.overrides) : null;
  const versions = [...history].reverse();
  return (
    <div className="history">
      {draftDiff && (
        <section className="rv-screen hv draft">
          <div className="hv-head">
            <h2>Current draft <span className="muted">(not submitted yet)</span></h2>
            <span className="muted">last saved {fmt(current.updatedAt)}</span>
          </div>
          <Diff diff={draftDiff} against={`v${history.length}`} />
        </section>
      )}
      {versions.map((v) => {
        const prev = history[v.version - 2];
        const diff = diffVersions(prev ? prev.overrides : EMPTY, v.overrides);
        const reopen = events.find((e) => e.type === "reopened" && e.afterVersion === v.version);
        return (
          <section key={v.version} className="rv-screen hv">
            <div className="hv-head">
              <h2>Version {v.version}{v.version === history.length && current.status === "submitted" ? <span className="pill">current</span> : null}</h2>
              <span className="muted">submitted {fmt(v.submittedAt)}</span>
              <button className="btn btn-light btn-sm" onClick={() => onDownload(v)}>Download v{v.version}</button>
            </div>
            <Diff diff={diff} against={prev ? `v${prev.version}` : "the original portal"} />
            {reopen && <p className="hv-event">↺ Reopened {fmt(reopen.at)}{reopen.note ? ` — “${reopen.note}”` : ""}</p>}
          </section>
        );
      })}
    </div>
  );
}

function Diff({ diff, against }) {
  if (!diff.total) return <p className="muted">No changes compared with {against}.</p>;
  const List = ({ title, items, render, cls }) =>
    items.length ? (
      <div className={`hv-list ${cls}`}>
        <h3>{title} ({items.length})</h3>
        <ul>{items.map((x, i) => <li key={i}>{render(x)} <span className="muted">· {x.place}</span></li>)}</ul>
      </div>
    ) : null;
  return (
    <div>
      <p className="muted">Compared with {against}:</p>
      <List title="Removed" cls="rm" items={diff.removed} render={(x) => x.label} />
      <List title="Brought back" cls="add" items={diff.restored} render={(x) => x.label} />
      <List title="Renamed" cls="rn" items={diff.renamed} render={(x) => <><s>{x.from}</s> → <b>{x.to}</b></>} />
      <List title="Order changed" cls="ord" items={diff.reordered} render={(x) => (x.container.startsWith("screen:") ? "Sections" : x.container.startsWith("menu") ? "Menu items" : "Fields / columns")} />
    </div>
  );
}
