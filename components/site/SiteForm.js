"use client";
// The website's forms (careers, vendor registration, enquiry, contact). Each field is checked when you leave it and
// again on submit; the server checks once more and emails the details to the address on the Contact page.
import { useEffect, useId, useRef, useState } from "react";
import { COMPANY_NAMES } from "@/lib/site";
import { FORM_SPECS, checkField, checkForm } from "@/lib/site-forms";

const valueOf = (el) => (el.type === "checkbox" ? el.checked : el.type === "file" ? el.files?.[0] ?? null : el.value);

export default function SiteForm({ form, submit, label }) {
  const spec = FORM_SPECS[form];
  const id = useId();
  const ref = useRef(null);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | failed
  const [failure, setFailure] = useState("");
  // a company page's button opens the form with that company chosen: /enquiry?company=<name>
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("company");
    if (c && COMPANY_NAMES.includes(c)) setCompany(c);
  }, []);

  const fid = (f) => `${id}-${f.id}`;
  const recheck = (f, el) => setErrors((e) => ({ ...e, [f.id]: checkField(f, valueOf(el)) }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const el = ref.current;
    const values = Object.fromEntries(spec.fields.map((f) => [f.id, valueOf(el.elements[f.id])]));
    const found = checkForm(spec, values);
    setErrors(found);
    const first = spec.fields.find((f) => found[f.id]);
    if (first) { el.elements[first.id].focus(); setState("idle"); return; }

    setState("sending");
    setFailure("");
    try {
      const body = new FormData(el);
      body.set("form", form);
      const r = await fetch("/api/site-form", { method: "POST", body });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (out.errors) setErrors(out.errors);
        setFailure(out.error || "Your details could not be sent. Please try again.");
        setState("failed");
        return;
      }
      el.reset();
      setCompany("");
      setErrors({});
      setState("sent");
    } catch {
      setFailure("Your details could not be sent. Check your connection and try again.");
      setState("failed");
    }
  };

  const count = Object.values(errors).filter(Boolean).length;
  return (
    <form ref={ref} className="hp-form" aria-label={label} noValidate onSubmit={onSubmit} onInput={() => state === "sent" && setState("idle")}>
      {/* left empty by people; bots that fill every field are dropped by the server */}
      <div className="hp-hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {spec.fields.map((f) => {
        const err = errors[f.id];
        const help = [f.hint && `${fid(f)}-hint`, err && `${fid(f)}-err`].filter(Boolean).join(" ") || undefined;
        const common = {
          id: fid(f), name: f.id, "aria-invalid": err ? true : undefined, "aria-describedby": help, "aria-required": f.required || undefined,
          onBlur: (e) => recheck(f, e.target),
          onChange: (e) => { if (errors[f.id]) recheck(f, e.target); },
        };
        const message = err && <p id={`${fid(f)}-err`} className="hp-ferr">{err}</p>;
        if (f.type === "consent") {
          return (
            <div key={f.id} className={`hp-wide ${err ? "hp-bad" : ""}`}>
              <label className="hp-consent"><input type="checkbox" {...common} />{f.label}</label>
              {message}
            </div>
          );
        }
        const wide = f.type === "textarea" || f.type === "file";
        return (
          <div key={f.id} className={`hp-field ${wide ? "hp-wide" : ""} ${err ? "hp-bad" : ""}`}>
            <label htmlFor={fid(f)}>{f.label}{f.required ? <span className="hp-req" aria-hidden="true"> *</span> : <span className="hp-opt"> (optional)</span>}</label>
            {f.type === "textarea" ? <textarea rows={4} maxLength={(f.max ?? 2000) + 50} {...common} />
              : f.type === "company" ? (
                <select {...common} value={company} onChange={(e) => { setCompany(e.target.value); common.onChange(e); }}>
                  <option value="">Select a company</option>
                  {COMPANY_NAMES.map((n) => <option key={n}>{n}</option>)}
                </select>
              ) : f.type === "file" ? <input type="file" accept={f.accept} {...common} onChange={(e) => recheck(f, e.target)} />
              : (
                <input
                  type={f.type}
                  maxLength={(f.max ?? 200) + 20}
                  inputMode={f.type === "tel" ? "tel" : undefined}
                  autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.rule === "name" ? "name" : undefined}
                  {...common}
                />
              )}
            {f.hint && <p id={`${fid(f)}-hint`} className="hp-fhint">{f.hint}</p>}
            {message}
          </div>
        );
      })}
      <div className="hp-wide hp-form-end">
        <button type="submit" className="hp-btn hp-btn-navy" disabled={state === "sending"}>{state === "sending" ? "Sending…" : submit}</button>
        {state === "sent" && <p className="hp-formok" role="status">Thank you. Your details have been submitted successfully.</p>}
        {state === "failed" && <p className="hp-formfail" role="alert">{failure}</p>}
        {state !== "failed" && count > 0 && <p className="hp-formfail" role="alert">Please correct the {count === 1 ? "field" : `${count} fields`} marked above.</p>}
      </div>
    </form>
  );
}
