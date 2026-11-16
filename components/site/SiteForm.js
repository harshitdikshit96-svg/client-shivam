"use client";
// The website's forms (enquiry, contact, careers, vendor registration). Nothing is sent anywhere yet:
// submitting clears the form and shows a thank-you message.
import { useEffect, useId, useState } from "react";
import { COMPANY_NAMES } from "@/lib/site";

export default function SiteForm({ fields, submit, label }) {
  const id = useId();
  const [company, setCompany] = useState("");
  const [done, setDone] = useState(false);
  // a company page's button opens the form with that company chosen: /enquiry?company=<slug-or-name>
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("company");
    if (c && COMPANY_NAMES.includes(c)) setCompany(c);
  }, []);

  return (
    <form className="hp-form" aria-label={label} noValidate onSubmit={(e) => { e.preventDefault(); e.currentTarget.reset(); setCompany(""); setDone(true); }} onInput={() => setDone(false)}>
      {fields.map(([name, type, options], i) => {
        const fid = `${id}-${i}`;
        if (type === "consent") {
          return <label key={name} className="hp-consent hp-wide"><input type="checkbox" />{name}</label>;
        }
        const wide = type === "textarea" || type === "file";
        return (
          <div key={name} className={`hp-field ${wide ? "hp-wide" : ""}`}>
            <label htmlFor={fid}>{name}</label>
            {type === "textarea" ? <textarea id={fid} rows={4} />
              : type === "company" ? (
                <select id={fid} value={company} onChange={(e) => setCompany(e.target.value)}>
                  <option value="">Select a company</option>
                  {COMPANY_NAMES.map((n) => <option key={n}>{n}</option>)}
                </select>
              ) : type === "select" ? (
                <select id={fid} defaultValue=""><option value="">Select</option>{options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : type === "file" ? <input id={fid} type="file" />
              : <input id={fid} type={type} autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : undefined} />}
          </div>
        );
      })}
      <div className="hp-wide hp-form-end">
        <button type="submit" className="hp-btn hp-btn-navy">{submit}</button>
        {done && <p className="hp-formok" role="status">Thank you. Your details have been submitted successfully.</p>}
      </div>
    </form>
  );
}
