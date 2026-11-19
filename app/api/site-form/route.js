// POST multipart form data from the website's forms → checked again here → emailed to the Contact page address.
// Public (no login). Bots are dropped by a hidden field and a per-address limit; nothing is stored.
import { NextResponse } from "next/server";
import { FORM_SPECS, checkForm, cleanValue } from "@/lib/site-forms";
import { buildMail, mailReady, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const MAX_BODY = 4_400_000; // Vercel refuses request bodies over 4.5 MB
const LIMIT = 5; // submissions per address per window
const WINDOW = 10 * 60 * 1000;
const seen = new Map(); // ip -> [timestamps]; per server instance, which is enough to slow a flood

function tooMany(ip) {
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.clear();
  return false;
}

const fail = (status, error, errors) => NextResponse.json({ error, ...(errors && { errors }) }, { status });

export async function POST(req) {
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return fail(413, "The attached files are too large. Please keep them under 4 MB in total.");
  let data;
  try {
    data = await req.formData();
  } catch {
    return fail(400, "The form could not be read. Please try again.");
  }
  const spec = FORM_SPECS[data.get("form")];
  if (!spec) return fail(400, "Unknown form.");
  // the hidden "website" field is empty for people; pretend success to bots
  if (data.get("website")) return NextResponse.json({ ok: true });

  const values = {};
  for (const f of spec.fields) {
    const v = data.get(f.id);
    values[f.id] = f.type === "consent" ? v === "on" : f.type === "file" ? (v && typeof v === "object" && v.size ? v : null) : typeof v === "string" ? v : "";
  }
  const errors = checkForm(spec, values);
  if (Object.keys(errors).length) return fail(422, "Please correct the fields marked above.", errors);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (tooMany(ip)) return fail(429, "Too many submissions from your connection. Please try again in a few minutes.");

  const rows = [];
  const files = [];
  for (const f of spec.fields) {
    const v = cleanValue(f, values[f.id]);
    if (f.type === "file") {
      if (v) files.push({ filename: v.name.replace(/[^\w.() -]/g, "_").slice(0, 120), content: Buffer.from(await v.arrayBuffer()) });
      rows.push([f.label, v ? v.name : ""]);
    } else if (f.type === "consent") rows.push(["Consent", v ? "Given" : "Not given"]);
    else rows.push([f.label, v]);
  }
  const replyTo = cleanValue({}, values.email || "");
  const mail = buildMail({ title: spec.title, rows, replyTo, files });

  if (!mailReady()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[site-form] RESEND_API_KEY not set; would email ${mail.to} "${mail.subject}"`);
      return NextResponse.json({ ok: true, dev: true });
    }
    console.error("[site-form] RESEND_API_KEY is not set; submission not sent");
    return fail(503, "Sorry, the form cannot be sent right now. Please email us directly.");
  }
  try {
    await sendMail(mail);
  } catch (e) {
    console.error("[site-form] send failed:", e.message);
    return fail(502, "Sorry, your details could not be sent. Please try again in a moment.");
  }
  return NextResponse.json({ ok: true });
}
