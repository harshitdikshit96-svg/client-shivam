// The website's four forms: their fields and the checks on each one. Used by the form in the browser
// (messages next to each field) and again by /api/site-form before anything is emailed.
import { COMPANY_NAMES } from "./site";

// field: { id, label, type, required?, max?, rule?, accept?, maxMB? }
// type: text | tel | email | company | textarea | file | consent
export const FORM_SPECS = {
  careers: {
    title: "Job application",
    fields: [
      { id: "name", label: "Full name", type: "text", required: true, rule: "name" },
      { id: "mobile", label: "Mobile number", type: "tel", required: true, rule: "mobile" },
      { id: "email", label: "Email address", type: "email", required: true, rule: "email" },
      { id: "company", label: "Preferred company", type: "company" },
      { id: "role", label: "Preferred role", type: "text", required: true, max: 100 },
      { id: "location", label: "Location", type: "text", required: true, max: 100 },
      { id: "experience", label: "Relevant experience", type: "textarea", required: true, max: 2000 },
      { id: "resume", label: "Resume upload", type: "file", required: true, accept: ".pdf,.doc,.docx", maxMB: 2, hint: "PDF or Word, up to 2 MB." },
      { id: "consent", label: "I consent to the processing of my application information.", type: "consent", required: true },
    ],
  },
  vendor: {
    title: "Vendor registration",
    fields: [
      { id: "firm", label: "Business or firm name", type: "text", required: true, max: 150 },
      { id: "person", label: "Contact person", type: "text", required: true, rule: "name" },
      { id: "mobile", label: "Mobile number", type: "tel", required: true, rule: "mobile" },
      { id: "email", label: "Email address", type: "email", required: true, rule: "email" },
      { id: "address", label: "Business address", type: "textarea", required: true, max: 500 },
      { id: "gst", label: "GST registration details, if applicable", type: "text", rule: "gstin", hint: "15-character GSTIN, e.g. 09ABCDE1234F1Z5." },
      { id: "pan", label: "PAN and business registration details", type: "text", required: true, rule: "pan", max: 300, hint: "Include the 10-character PAN, e.g. ABCDE1234F." },
      { id: "offer", label: "Products or services offered", type: "textarea", required: true, max: 2000 },
      { id: "coverage", label: "Geographic service coverage", type: "text", required: true, max: 200 },
      { id: "licences", label: "Relevant licences and certifications", type: "textarea", max: 2000 },
      { id: "docs", label: "Company profile and supporting documents", type: "file", accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png", maxMB: 3, hint: "PDF, Word, JPG or PNG, up to 3 MB." },
    ],
  },
  enquiry: {
    title: "Business enquiry",
    fields: [
      { id: "name", label: "Name", type: "text", required: true, rule: "name" },
      { id: "org", label: "Organization", type: "text", max: 150 },
      { id: "mobile", label: "Mobile number", type: "tel", required: true, rule: "mobile" },
      { id: "email", label: "Email address", type: "email", required: true, rule: "email" },
      { id: "company", label: "Company of interest", type: "company", required: true },
      { id: "nature", label: "Nature of enquiry", type: "text", required: true, max: 150 },
      { id: "city", label: "City and state", type: "text", required: true, max: 100 },
      { id: "scope", label: "Estimated requirement or project scope", type: "textarea", max: 2000 },
      { id: "message", label: "Message", type: "textarea", required: true, min: 10, max: 2000 },
    ],
  },
  contact: {
    title: "Contact form",
    fields: [
      { id: "name", label: "Name", type: "text", required: true, rule: "name" },
      { id: "phone", label: "Phone", type: "tel", required: true, rule: "mobile" },
      { id: "email", label: "Email", type: "email", required: true, rule: "email" },
      { id: "company", label: "Company", type: "company" },
      { id: "subject", label: "Enquiry", type: "text", required: true, max: 150 },
      { id: "message", label: "Message", type: "textarea", required: true, min: 10, max: 2000 },
    ],
  },
};

const RULES = {
  name: [/^[\p{L}][\p{L} .'-]{1,79}$/u, "Enter a name using letters only (2 to 80 characters)."],
  // Indian mobile: 10 digits starting 6–9, optionally after +91 / 91 / 0; spaces and dashes are fine
  mobile: [/^(?:\+?91|0)?[6-9]\d{9}$/, "Enter a 10-digit mobile number, e.g. 98765 43210."],
  email: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address, e.g. name@example.com."],
  gstin: [/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN, e.g. 09ABCDE1234F1Z5."],
  pan: [/\b[A-Z]{5}\d{4}[A-Z]\b/, "Include a valid 10-character PAN, e.g. ABCDE1234F."],
};
const tidy = (rule, v) => (rule === "mobile" ? v.replace(/[\s-]/g, "") : rule === "gstin" || rule === "pan" ? v.toUpperCase() : v);
const extOf = (n) => (n.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();

/** The message for one field, or "" when it is fine. `v` is a string, a boolean (consent) or a File-like { name, size }. */
export function checkField(f, v) {
  if (f.type === "consent") return v ? "" : "Please tick this box to continue.";
  if (f.type === "file") {
    if (!v || !v.size) return f.required ? `Please attach your ${f.label.replace(/ upload$/i, "").toLowerCase()}.` : "";
    if (!f.accept.split(",").includes(extOf(v.name))) return `This file type is not accepted. ${f.hint}`;
    if (v.size > f.maxMB * 1024 * 1024) return `The file is larger than ${f.maxMB} MB.`;
    return "";
  }
  const s = String(v ?? "").trim();
  if (!s) return f.required ? "This field is required." : "";
  if (f.type === "company" && !COMPANY_NAMES.includes(s)) return "Please choose a company from the list.";
  if (f.min && s.length < f.min) return `Please write at least ${f.min} characters.`;
  const max = f.max ?? (f.type === "textarea" ? 2000 : 200);
  if (s.length > max) return `Please keep this under ${max} characters (now ${s.length}).`;
  const rule = RULES[f.rule];
  if (rule && !rule[0].test(tidy(f.rule, s))) return rule[1];
  return "";
}

/** { fieldId: message } for every field with a problem; empty when the whole form is fine. */
export function checkForm(spec, values) {
  const errors = {};
  for (const f of spec.fields) {
    const m = checkField(f, values[f.id]);
    if (m) errors[f.id] = m;
  }
  return errors;
}

/** The value as it will be emailed (mobile without spaces, GSTIN / PAN upper-case, text trimmed). */
export const cleanValue = (f, v) => (typeof v === "string" ? tidy(f.rule, v.trim()) : v);
