"use client";
// Date box shown and typed as dd/mm/yyyy, whatever language the browser is set to (the browser's own date box follows
// the computer's settings and may show mm/dd/yyyy). The value it gives back stays "YYYY-MM-DD", the date the database
// keeps, so every check and sort works on real dates. The calendar button opens the browser's date picker.
import { useEffect, useRef, useState } from "react";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** "2026-11-19" → "19/11/2026" (anything else unchanged). */
export const toDmy = (v) => (ISO.test(v ?? "") ? v.split("-").reverse().join("/") : v ?? "");
/** "19/11/2026" (or "19-11-2026", "19.11.2026", or a pasted "2026-11-19") → "2026-11-19". Anything else is
 *  returned as typed, so the field's check says "Should be a valid date". */
export function parseDmy(t) {
  const s = String(t ?? "").trim();
  if (!s || ISO.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}
// typing digits puts the slashes in: 19112026 → 19/11/2026 (a slash is never added at the end, so deleting works)
const mask = (raw) => {
  if (ISO.test(raw)) return toDmy(raw);
  if (/[^\d/]/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export default function DateInput({ value, onChange, onBlur, readOnly, label, invalid, autoFocus, min = "1900-01-01", max = "2100-12-31" }) {
  const [text, setText] = useState(() => toDmy(value));
  const sent = useRef(value ?? "");
  const picker = useRef(null);
  // a new value from outside (a record loaded, the form cleared) replaces what is shown
  useEffect(() => {
    if ((value ?? "") !== sent.current) { sent.current = value ?? ""; setText(toDmy(value)); }
  }, [value]);
  const emit = (t) => {
    setText(t);
    sent.current = parseDmy(t);
    onChange(sent.current);
  };
  const open = () => {
    const p = picker.current;
    try { p.showPicker(); } catch { p.focus(); p.click(); }
  };
  return (
    <span className="date-input">
      <input type="text" inputMode="numeric" placeholder="dd/mm/yyyy" maxLength={10} value={text} readOnly={readOnly}
        aria-label={label} aria-invalid={invalid || undefined} autoFocus={autoFocus}
        onChange={(e) => emit(mask(e.target.value))} onBlur={() => onBlur?.({ target: { value: parseDmy(text) } })} />
      {!readOnly && (
        <button type="button" className="date-pick" aria-label="Pick a date" title="Pick a date on a calendar" onClick={open}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" /></svg>
        </button>
      )}
      <input ref={picker} type="date" className="date-native" tabIndex={-1} aria-hidden="true" min={min} max={max}
        value={ISO.test(value ?? "") ? value : ""} onChange={(e) => emit(toDmy(e.target.value))} />
    </span>
  );
}
