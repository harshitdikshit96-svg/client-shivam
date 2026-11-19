// Sends the website's form submissions by email through Resend (added to the Vercel project from the Marketplace).
// Env: RESEND_API_KEY (from the integration); MAIL_FROM, e.g. "Shivanji Group Website <website@shivanjigroup.in>",
// on a domain verified in Resend; MAIL_TO overrides the Contact page address (lib/site.js EMAIL).
import { EMAIL } from "./site";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const mailReady = () => !!process.env.RESEND_API_KEY;

/** rows: [label, value][]; files: { filename, content (Buffer) }[] */
export function buildMail({ title, rows, replyTo, files = [] }) {
  const who = rows.find(([l]) => /name/i.test(l))?.[1] || "website visitor";
  const subject = `Website: ${title} from ${who}`.slice(0, 200);
  const text = `${title} (sent from the website)\n\n${rows.map(([l, v]) => `${l}: ${v || "—"}`).join("\n")}${files.length ? `\n\nAttached: ${files.map((f) => f.filename).join(", ")}` : ""}\n`;
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#13294A">
<h2 style="margin:0 0 4px;font-size:18px">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#5B6676">Sent from the Shivanji Group website. Reply to this email to answer ${esc(who)}.</p>
<table cellpadding="8" style="border-collapse:collapse;max-width:640px">${rows.map(([l, v]) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #E5E0D6;width:38%">${esc(l)}</th><td style="border-bottom:1px solid #E5E0D6;white-space:pre-wrap">${esc(v || "—")}</td></tr>`).join("")}</table>
${files.length ? `<p style="color:#5B6676">Attached: ${files.map((f) => esc(f.filename)).join(", ")}</p>` : ""}</div>`;
  return {
    from: process.env.MAIL_FROM || "Shivanji Group Website <onboarding@resend.dev>",
    to: [process.env.MAIL_TO || EMAIL],
    reply_to: replyTo || undefined,
    subject,
    text,
    html,
    attachments: files.map((f) => ({ filename: f.filename, content: f.content.toString("base64") })),
  };
}

export async function sendMail(mail) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
