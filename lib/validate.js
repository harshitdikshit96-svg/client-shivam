// Field formats shared by the screens (while typing / on leaving a field) and the server (lib/ops.js, on save).
// Each form field in lib/schema.js names its format; the same rule then applies everywhere.
//   digits  – only 0-9 can be typed          upper – typed letters become capitals
//   max     – longest value (also stops values the database column could not hold)
//   re      – the value must match            msg   – what to tell the user when it does not
import { RULES } from "./rules.js";

const CODE = /^[A-Za-z0-9][A-Za-z0-9 /._-]*$/;
// letters of any script (Hindi, Bengali, Assamese… as well as English), plus their accents
const PERSON = /^\p{L}[\p{L}\p{M} .'-]*$/u;
const PLACE = /^\p{L}[\p{L}\p{M}0-9 .,'()&/-]*$/u;

export const FORMATS = {
  // identity numbers
  aadhaar: { digits: true, max: 12, re: /^\d{12}$/, msg: "12 digits, numbers only", hint: "12 digits" },
  pan: { upper: true, max: 10, re: /^[A-Z]{5}\d{4}[A-Z]$/, msg: "5 letters, 4 digits, 1 letter (like ABCDE1234F)", hint: "ABCDE1234F" },
  gstin: { upper: true, max: 15, re: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, msg: "15 characters (like 09ABCDE1234F1Z5)", hint: "15 characters" },
  uan: { upper: true, max: 20, re: /^[A-Z0-9/-]{6,20}$/, msg: "6 to 20 letters or numbers (UAN is 12 digits)", hint: "UAN: 12 digits" },
  esicIp: { digits: true, max: 10, re: /^\d{10}$/, msg: "10 digits", hint: "10 digits" },
  esicCode: { digits: true, max: 17, re: /^\d{17}$/, msg: "17 digits", hint: "17 digits" },
  // contact
  mobile: { digits: true, max: 10, re: /^[6-9]\d{9}$/, msg: "a 10-digit mobile number starting with 6, 7, 8 or 9", hint: "10 digits" },
  contact: { max: 100, re: /^([+0-9][0-9 ()-]{5,19}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, msg: "a phone number or an email address" },
  email: { max: 100, re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg: "a valid email address (like name@example.com)" },
  pincode: { digits: true, max: 6, re: /^[1-9]\d{5}$/, msg: "6 digits, not starting with 0", hint: "6 digits" },
  // bank
  bankAc: { digits: true, max: 18, re: /^\d{9,18}$/, msg: "9 to 18 digits, numbers only", hint: "9–18 digits" },
  ifsc: { upper: true, max: 11, re: /^[A-Z]{4}0[A-Z0-9]{6}$/, msg: "11 characters: 4 letters, 0, then 6 letters or numbers (like SBIN0001234)", hint: "SBIN0001234" },
  // names and free text
  personName: { max: 100, re: PERSON, msg: "letters, spaces and . ' - only" },
  place: { max: 100, re: PLACE, msg: "letters, numbers, spaces and . , ' ( ) & / - only" },
  code: { max: 64, re: CODE, msg: "letters, numbers and / . _ - only (no other symbols)" },
  text: { max: 200 },
  longText: { max: 500 },
  password: { min: 10, max: 128, msg: "at least 10 characters" },
  // numbers and dates
  money: { number: true, max: 13, re: /^\d{1,10}(\.\d{1,2})?$/, msg: "an amount like 1250 or 1250.50 (2 decimals at most)" },
  positiveMoney: { number: true, max: 13, re: /^\d{1,10}(\.\d{1,2})?$/, positive: true, msg: "an amount more than 0 with at most 2 decimals (like 556 or 556.50)" },
  percent: { number: true, max: 6, re: /^\d{1,3}(\.\d{1,2})?$/, range: [0, 100], msg: "a percentage between 0 and 100" },
  decimal: { number: true, max: 6, re: /^\d{1,2}(\.\d{1,2})?$/, msg: "a number like 2 or 1.5" },
  int: { number: true, max: 4, re: /^\d+$/, msg: "a whole number" },
  date: { re: /^\d{4}-\d{2}-\d{2}$/, msg: "a date", date: true },
};

const isRealDate = (v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= "1900-01-01" && v <= "2100-12-31";
};

/** What the user is allowed to type into the field: drops letters from number fields, capitalises codes, cuts at max (while typing). */
export function sanitize(format, typed, { cut = true } = {}) {
  const f = FORMATS[format];
  if (!f || typed == null) return typed;
  let v = String(typed);
  if (f.digits || format === "int") v = v.replace(/\D/g, "");
  else if (f.number) v = v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");   // digits and one decimal point
  if (f.upper) v = v.toUpperCase().replace(/\s/g, "");
  if (cut && f.max && !f.date) v = v.slice(0, f.max);   // the server passes cut: false and reports the length instead
  return v;
}

/**
 * Check one value. Returns null when fine, else the message to show ("Should be …").
 * With RULES.checkFormats off only the length limits are kept (so the database can always store the value).
 */
export function checkValue(format, raw, { min, max } = {}) {
  const f = FORMATS[format] ?? FORMATS.text;
  const v = raw == null ? "" : String(raw).trim();
  if (v === "") return null;
  const limit = max ?? f.max;
  if (limit && !f.number && !f.date && v.length > limit) return `Should be at most ${limit} characters`;
  if (f.date) return isRealDate(v) ? null : "Should be a valid date";
  if (f.number) {
    if (!/^\d+(\.\d+)?$/.test(v)) return `Should be ${f.msg}`;
    const n = Number(v);
    if (RULES.checkFormats && f.re && !f.re.test(v)) return `Should be ${f.msg}`;
    if (f.positive && n <= 0) return "Should be more than 0";
    if (f.range && (n < f.range[0] || n > f.range[1])) return `Should be between ${f.range[0]} and ${f.range[1]}`;
    if (min != null && n < min) return `Should be at least ${min}`;
    if (max != null && n > max) return `Should be at most ${max}`;
    return null;
  }
  if (f.min && v.length < f.min) return `Should be ${f.msg}`;
  if (RULES.checkFormats && f.re && !f.re.test(v)) return `Should be ${f.msg}`;
  return null;
}

/** Attributes for the input element. */
export function inputProps(format) {
  const f = FORMATS[format];
  if (!f) return { maxLength: FORMATS.text.max };
  return {
    ...(f.max && !f.date ? { maxLength: f.max } : {}),
    ...(f.digits ? { inputMode: "numeric" } : f.number ? { inputMode: "decimal" } : {}),
    ...(f.hint ? { placeholder: f.hint } : {}),
  };
}
