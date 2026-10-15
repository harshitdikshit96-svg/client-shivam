"use client";
// Customization state: overrides, undo/redo, autosave, confirm dialog, toolbar.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { EMPTY, isHidden, labelOf, norm } from "@/lib/resolve";
import { SCREENS } from "@/lib/schema";

const Ctx = createContext(null);
export const useCust = () => useContext(Ctx);

export function CustProvider({ k, initial, children }) {
  const [ov, setOv] = useState(() => norm(initial.overrides));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [status, setStatus] = useState(initial.status || "draft");
  const [mode, setMode] = useState(initial.status === "submitted" ? "preview" : "customize");
  const [save, setSave] = useState({ state: "idle", at: initial.updatedAt });
  const [editing, setEditing] = useState(null);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);
  const latest = useRef(ov);
  latest.current = ov;

  const locked = status === "submitted" || status === "final";
  const customizing = mode === "customize" && !locked;

  const persist = useCallback(async () => {
    setSave((s) => ({ ...s, state: "saving" }));
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k, overrides: latest.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSave({ state: "saved", at: data.updatedAt });
    } catch (e) {
      setSave((s) => ({ ...s, state: "error", error: e.message }));
    }
  }, [k]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    setSave((s) => ({ ...s, state: "pending" }));
    timer.current = setTimeout(persist, 700);
  }, [persist]);

  const apply = useCallback(
    (fn) => {
      if (locked) return;
      const cur = latest.current;
      const next = fn(norm(cur));
      latest.current = next;
      setPast((p) => [...p.slice(-99), cur]);
      setFuture([]);
      setOv(next);
      schedule();
    },
    [locked, schedule]
  );

  const undo = useCallback(() => {
    if (locked || !past.length) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [ov, ...f]);
    setOv(prev);
    schedule();
  }, [locked, past, ov, schedule]);

  const redo = useCallback(() => {
    if (locked || !future.length) return;
    const nxt = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, ov]);
    setOv(nxt);
    schedule();
  }, [locked, future, ov, schedule]);

  const ask = (opts) => new Promise((resolve) => setDialog({ ...opts, resolve }));

  const hide = async (id, item) => {
    if (item?.locked) return;
    if (item?.feeds?.length) {
      const ok = await ask({
        title: `Hide "${labelOf(ov, id, item.label)}"?`,
        body: `This column is used to calculate ${item.feeds.join(", ")}. If you hide it, it will not be part of those calculations in the final system.`,
        confirm: "Hide column",
      });
      if (!ok) return;
    }
    apply((o) => ({ ...o, hidden: { ...o.hidden, [id]: true } }));
  };
  const show = (id) =>
    apply((o) => {
      const hidden = { ...o.hidden };
      delete hidden[id];
      return { ...o, hidden };
    });
  const rename = (id, label, original) =>
    apply((o) => {
      const labels = { ...o.labels };
      const v = (label || "").trim();
      if (!v || v === original) delete labels[id];
      else labels[id] = v;
      return { ...o, labels };
    });
  // siblings: local ids in current display order
  const move = (container, siblings, localId, toIndex) =>
    apply((o) => {
      const list = siblings.filter((x) => x !== localId);
      const idx = Math.max(0, Math.min(list.length, toIndex));
      list.splice(idx, 0, localId);
      return { ...o, order: { ...o.order, [container]: list } };
    });
  const reset = async () => {
    const ok = await ask({
      title: "Reset everything?",
      body: "All hidden fields come back, labels and order return to the original. You can still undo this.",
      confirm: "Reset",
    });
    if (ok) apply(() => norm(EMPTY));
  };
  const submitFinal = async () => {
    const ok = await ask({
      title: "Submit final selection?",
      body: "This sends your selection to Harshit and locks editing. If you need changes later, he can reopen it.",
      confirm: "Submit final",
    });
    if (!ok) return;
    clearTimeout(timer.current);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k, overrides: latest.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setStatus("submitted");
      setMode("preview");
      setSave({ state: "saved", at: data.submittedAt });
    } catch (e) {
      await ask({ title: "Could not submit", body: e.message, confirm: "OK", noCancel: true });
    }
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const value = {
    ov, mode, setMode, customizing, locked, status, save,
    canUndo: past.length > 0, canRedo: future.length > 0,
    undo, redo, hide, show, rename, move, reset, submitFinal,
    editing, setEditing,
    label: (id, def) => labelOf(ov, id, def),
    hidden: (id) => isHidden(ov, id),
    hiddenCount: Object.keys(ov.hidden).length,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog && (
        <div className="modal-back" onClick={() => { dialog.resolve(false); setDialog(null); }}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{dialog.title}</h3>
            <p>{dialog.body}</p>
            <div className="modal-actions">
              {!dialog.noCancel && (
                <button className="btn btn-light" onClick={() => { dialog.resolve(false); setDialog(null); }}>Cancel</button>
              )}
              <button className="btn btn-primary" autoFocus onClick={() => { dialog.resolve(true); setDialog(null); }}>{dialog.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

function SaveBadge() {
  const { save, locked } = useCust();
  if (locked) return <span className="badge ok">Submitted</span>;
  const t = save.at ? new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  if (save.state === "pending" || save.state === "saving") return <span className="badge">Saving…</span>;
  if (save.state === "error") return <span className="badge err" title={save.error}>Not saved — retrying on next change</span>;
  return <span className="badge ok">{t ? `Saved ${t}` : "All changes save automatically"}</span>;
}

export function Toolbar({ screen, onJump }) {
  const c = useCust();
  return (
    <div className="toolbar">
      <div className="tb-left">
        <strong>Field selection</strong>
        {!c.locked && (
          <div className="seg" role="group" aria-label="Mode">
            <button className={c.mode === "customize" ? "on" : ""} onClick={() => c.setMode("customize")}>Customize</button>
            <button className={c.mode === "preview" ? "on" : ""} onClick={() => c.setMode("preview")}>Preview</button>
          </div>
        )}
        {!c.locked && (
          <>
            <button className="tb-btn" onClick={c.undo} disabled={!c.canUndo} title="Undo (Ctrl/Cmd+Z)">↶ Undo</button>
            <button className="tb-btn" onClick={c.redo} disabled={!c.canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">↷ Redo</button>
            <button className="tb-btn" onClick={c.reset}>Reset</button>
          </>
        )}
        <span className="tb-muted">{c.hiddenCount} hidden</span>
        <SaveBadge />
      </div>
      <div className="tb-right">
        <label className="tb-jump">
          <span>Screen</span>
          <select value={screen} onChange={(e) => onJump(e.target.value)}>
            {SCREENS.map((s) => (
              <option key={s.id} value={s.id}>{c.label(`${s.id}.title`, s.title)}</option>
            ))}
          </select>
        </label>
        {!c.locked && <button className="btn btn-success btn-sm" onClick={c.submitFinal}>Submit final</button>}
      </div>
    </div>
  );
}
