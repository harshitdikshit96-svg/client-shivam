"use client";
// The statutory documents on screen and on paper: Form D (wage statement) and FORM VIII-C (wage slip).
// They open full-screen over the portal; "Print / Save as PDF" prints only the document (A4: landscape for Form D,
// portrait for the slip). Form D has "Page n/m" and the CUIN / time stamp at the bottom of every page, as in its format.
// The headings and values come from lib/forms.js.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FORM_D_NUMBER_COLUMNS } from "@/lib/forms";

const cssString = (s) => JSON.stringify(String(s ?? "").replace(/[<>]/g, ""));

export function PrintOverlay({ title, landscape, footer, numbered, onClose, children }) {
  useEffect(() => {
    document.body.classList.add("printing");
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("printing"); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const page = `@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm 8mm 14mm;
    ${numbered ? '@bottom-left { content: "Page " counter(page) "/" counter(pages); font: 13pt "DejaVu Sans", Verdana, Arial, sans-serif; }' : ""}
    ${footer ? `@bottom-right { content: ${cssString(footer)}; font: 7pt "DejaVu Sans", Verdana, Arial, sans-serif; }` : ""} }`;
  return createPortal(
    <div className="print-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <style>{page}</style>
      <div className="print-bar">
        <strong>{title}</strong>
        <span className="print-bar-actions">
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="btn btn-light" onClick={onClose}>Close</button>
        </span>
      </div>
      <div className={`print-page ${landscape ? "landscape" : "portrait"}`}>{children}</div>
    </div>,
    document.body,
  );
}

/** WAGE STATEMENT FOR THE MONTH OF … (Form D) */
export function FormD({ doc }) {
  return (
    <div className="formd">
      <h2 className="doc-title">{doc.title}</h2>
      <table className="formd-head">
        <tbody>
          {doc.header.map(([a, b, c, d]) => (
            <tr key={a}><th scope="row">{a}</th><td>{b}</td><th scope="row">{c}</th><td>{d}</td></tr>
          ))}
        </tbody>
      </table>
      <table className="formd-grid">
        <thead><tr>{doc.columns.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {doc.rows.length ? doc.rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className={FORM_D_NUMBER_COLUMNS.has(j) ? "n" : ""}>{v}</td>)}</tr>
          )) : <tr><td colSpan={doc.columns.length}>No wages saved for this month.</td></tr>}
        </tbody>
      </table>
      <p className="formd-verified">{doc.verified}</p>
      <p className="doc-footer">{doc.footer}</p>
    </div>
  );
}

/** FORM – VIII-C wage slip */
export function WageSlip({ doc }) {
  return (
    <div className="slip">
      <div className="slip-heading">
        <p className="b">{doc.heading[0]}</p>
        <p className="b big">{doc.heading[1]}</p>
        <p className="b small">{doc.heading[2]}</p>
        <p className="b">{doc.heading[3]}</p>
      </div>
      <table className="slip-table">
        <colgroup><col className="c-no" /><col className="c-label" /><col /><col /><col /></colgroup>
        <tbody>
          <tr><td colSpan={5}>{doc.dateOfIssue}</td></tr>
          <tr><td colSpan={5}>{doc.establishment}</td></tr>
          <tr><td colSpan={4}>{doc.address}</td><td>{doc.period}</td></tr>
          {doc.items.map(([no, label, value]) => (
            <tr key={no}>
              <td>{no}</td>
              <td>{label}</td>
              {Array.isArray(value)
                ? value.map((p) => (
                  <td key={p.label} className="part">
                    <span className="b">{p.label}</span> {p.value}
                    {p.note && <span className="note">{p.note}</span>}
                  </td>
                ))
                : <td colSpan={3}>{value}</td>}
            </tr>
          ))}
          <tr><td colSpan={5} className="sign">{doc.signature}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
