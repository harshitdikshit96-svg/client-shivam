"use client";
// Live data for the screens (final mode): the selected firm's records from /api/data, actions (POST /api/data),
// the message bar shown after every action, and the confirm / date dialogs. Without a provider (prototype mode,
// spec tests) useData() is null and the screens render their empty spec layout.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

const FIRM_KEY = "firmId";
const readFirm = () => {
  try { return Number(localStorage.getItem(FIRM_KEY)) || null; } catch { return null; }
};

/** An action the server refused, with what to fix. */
export class ActionError extends Error {
  constructor(message, { fields, fix, loggedOut } = {}) { super(message); this.fields = fields ?? {}; this.fix = fix ?? null; this.loggedOut = !!loggedOut; }
}

async function httpApi(method, body, firmId) {
  let r;
  try {
    r = method === "GET"
      ? await fetch(`/api/data${firmId ? `?firm=${firmId}` : ""}`, { cache: "no-store" })
      : await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    // no answer at all: offline, server down, or the connection dropped
    throw new ActionError(method === "GET"
      ? "Cannot reach the server. Check the connection; the page will work again once it is back."
      : "Cannot reach the server, so nothing was saved. Check the connection and press the button again.");
  }
  let json = {};
  try { json = await r.json(); } catch { /* empty body */ }
  if (!r.ok) {
    const fallback = r.status >= 500 ? "The server had a problem and nothing was changed. Please try again in a moment."
      : r.status === 413 ? "That is too much data to send at once." : "The request was refused.";
    throw new ActionError(json.error || fallback, json);
  }
  return method === "GET" ? json : json.result;
}

/**
 * api(method, body, firmId) can be replaced in tests; initialData skips the first load.
 */
export function DataProvider({ children, api = httpApi, initialData = null, onLoggedOut }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);   // { type: "ok" | "error" | "info", text, fix, fields }
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(null);   // { year, month } shared by the wage lists
  const firmRef = useRef(initialData?.firm?.id ?? null);

  const load = useCallback(async (id = firmRef.current) => {
    try {
      const body = await api("GET", null, id);
      firmRef.current = body.firm?.id ?? null;
      setData(body);
      setError(null);
      return body;
    } catch (e) {
      if (e.loggedOut) onLoggedOut?.();
      else setError(e.message);
      return null;
    }
  }, [api, onLoggedOut]);

  useEffect(() => { if (!initialData) load(readFirm()); }, [load, initialData]);

  const setFirm = useCallback((id) => {
    try { localStorage.setItem(FIRM_KEY, String(id)); } catch { /* private mode */ }
    setNotice(null);
    return load(id);
  }, [load]);

  /** Run an operation; refreshes the data afterwards. Throws ActionError for the screen to show. */
  const run = useCallback(async (op, args = {}, { refresh = true } = {}) => {
    setBusy(true);
    try {
      const result = await api("POST", { op, firmId: firmRef.current, ...args });
      if (refresh) await load();
      return result;
    } catch (e) {
      if (e.loggedOut) onLoggedOut?.();
      throw e instanceof ActionError ? e : new ActionError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [api, load, onLoggedOut]);

  const notify = useCallback((type, text, extra = {}) => setNotice(text ? { type, text, ...extra } : null), []);
  /** Show an ActionError (or any error) in the message bar. */
  const fail = useCallback((e) => setNotice({ type: "error", text: e.message, fix: e.fix, fields: e.fields }), []);

  // ask({ title, body, confirm, input: { type, label, value } | inputs: [{ name, type, label, value }] })
//   → false | true | the typed value | { name: value }
  const ask = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const value = {
    data, error, busy, notice, notify, fail, run, reload: load, setFirm, ask,
    firmId: data?.firm?.id ?? null, period, setPeriod,
  };
  return (
    <DataCtx.Provider value={value}>
      {children}
      {dialog && <Dialog dialog={dialog} close={(v) => { dialog.resolve(v); setDialog(null); }} />}
    </DataCtx.Provider>
  );
}

function Dialog({ dialog, close }) {
  const [v, setV] = useState(dialog.input?.value ?? "");
  const [many, setMany] = useState(() => Object.fromEntries((dialog.inputs ?? []).map((i) => [i.name, i.value ?? ""])));
  const ok = () => close(dialog.inputs ? many : dialog.input ? (v || false) : true);
  return (
    <div className="modal-back" onClick={() => close(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={dialog.title} onClick={(e) => e.stopPropagation()}>
        <h3>{dialog.title}</h3>
        {dialog.body && <p>{dialog.body}</p>}
        {dialog.input && (
          <label className="field">
            <span>{dialog.input.label}</span>
            <input type={dialog.input.type || "text"} value={v} onChange={(e) => setV(e.target.value)} aria-label={dialog.input.label} autoFocus />
          </label>
        )}
        {dialog.inputs?.map((i) => (
          <label className="field" key={i.name}>
            <span>{i.label}</span>
            <input type={i.type || "text"} value={many[i.name]} onChange={(e) => setMany((m) => ({ ...m, [i.name]: e.target.value }))} aria-label={i.label} />
          </label>
        ))}
        <div className="modal-actions">
          <button className="btn btn-light" onClick={() => close(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={ok} disabled={dialog.input && !v}>{dialog.confirm || "OK"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- formatting / small helpers shared by the screens ----------
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;
export const fmtDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v);
export const fmtMoney = (v) => (v == null || v === "" ? "" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const todayIso = () => new Date().toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const firstDay = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
/** Was the engagement running at any point in the month? */
export const engagedInMonth = (e, y, m) => e.from <= lastDay(y, m) && (!e.to || e.to >= firstDay(y, m));
/** Does the work order run in the month? */
export const orderInMonth = (o, y, m) => o.start <= lastDay(y, m) && o.end >= firstDay(y, m);

/** One CSV cell. A value starting with = + - @ (or tab / CR) would run as a formula in Excel: it is kept as text. */
export function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Download rows as a CSV file (opens in Excel). columns: [{ id, label }] */
export function downloadCsv(filename, columns, rows) {
  const esc = csvCell;
  const text = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.id])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
