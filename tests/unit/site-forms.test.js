// Website forms: the field checks (shared by the browser and the server) and the /api/site-form endpoint.
import { describe, it, expect, vi, afterEach } from "vitest";
import { FORM_SPECS, checkField, checkForm } from "@/lib/site-forms";
import { COMPANY_NAMES } from "@/lib/site";

const field = (form, id) => FORM_SPECS[form].fields.find((f) => f.id === id);
const file = (name, size) => new File([new Uint8Array(size)], name);

describe("form field checks", () => {
  it("mobile numbers: 10 digits starting 6–9, with or without +91 / 0 and spaces", () => {
    const f = field("contact", "phone");
    for (const ok of ["9876543210", "+91 98765 43210", "09876543210", "91-98765-43210"]) expect(checkField(f, ok)).toBe("");
    for (const bad of ["12345", "5876543210", "98765432100", "abcdefghij"]) expect(checkField(f, bad)).toMatch(/10-digit/);
  });
  it("names, emails, required and length limits", () => {
    expect(checkField(field("contact", "name"), "Ravi Kumar")).toBe("");
    expect(checkField(field("contact", "name"), "R2D2")).toMatch(/letters only/);
    expect(checkField(field("contact", "email"), "ravi@example.com")).toBe("");
    expect(checkField(field("contact", "email"), "ravi@example")).toMatch(/valid email/);
    expect(checkField(field("contact", "subject"), "  ")).toBe("This field is required.");
    expect(checkField(field("contact", "message"), "short")).toMatch(/at least 10/);
    expect(checkField(field("contact", "message"), "x".repeat(2001))).toMatch(/under 2000/);
    expect(checkField(field("contact", "company"), "")).toBe(""); // optional here
    expect(checkField(field("enquiry", "company"), "")).toBe("This field is required.");
    expect(checkField(field("enquiry", "company"), "Some Other Ltd")).toMatch(/from the list/);
    expect(checkField(field("enquiry", "company"), "Shivanji HR Solutions Private Limited")).toBe("");
  });
  it("vendor GSTIN is optional but must be valid; PAN must be in the registration details", () => {
    expect(checkField(field("vendor", "gst"), "")).toBe("");
    expect(checkField(field("vendor", "gst"), "09abcde1234f1z5")).toBe("");
    expect(checkField(field("vendor", "gst"), "09ABCDE1234")).toMatch(/GSTIN/);
    expect(checkField(field("vendor", "pan"), "PAN ABCDE1234F, Udyam UP-12-0012345")).toBe("");
    expect(checkField(field("vendor", "pan"), "Udyam UP-12-0012345")).toMatch(/PAN/);
  });
  it("files: type and size; the resume is required, vendor documents are not", () => {
    const resume = field("careers", "resume");
    expect(checkField(resume, null)).toMatch(/attach your resume/);
    expect(checkField(resume, file("cv.pdf", 1000))).toBe("");
    expect(checkField(resume, file("cv.exe", 1000))).toMatch(/not accepted/);
    expect(checkField(resume, file("cv.pdf", 3 * 1024 * 1024))).toMatch(/larger than 2 MB/);
    expect(checkField(field("vendor", "docs"), null)).toBe("");
    expect(checkField(field("careers", "consent"), false)).toMatch(/tick/);
  });
  it("every company, including Shivanji HR Solutions, can be chosen", () => {
    expect(COMPANY_NAMES).toContain("Shivanji HR Solutions Private Limited");
    expect(COMPANY_NAMES).toHaveLength(8);
  });
});

describe("POST /api/site-form", () => {
  const post = async (fields) => {
    const { POST } = await import("@/app/api/site-form/route");
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return POST(new Request("http://x/api/site-form", { method: "POST", body, headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` } }));
  };
  const contact = { form: "contact", name: "Ravi Kumar", phone: "+91 98765 43210", email: "ravi@example.com", subject: "Guards", message: "Need ten guards for a warehouse." };
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("emails a valid submission to the Contact page address through Resend, replying to the visitor", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const send = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
    const r = await post(contact);
    expect(r.status).toBe(200);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const mail = JSON.parse(init.body);
    expect(mail.to).toEqual(["contact@shivanjigroup.in"]);
    expect(mail.reply_to).toBe("ravi@example.com");
    expect(mail.subject).toBe("Website: Contact form from Ravi Kumar");
    expect(mail.text).toContain("Phone: +919876543210");
    expect(mail.html).not.toContain("<script");
  });

  it("attaches the resume on a job application", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const send = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const r = await post({ form: "careers", name: "Asha Verma", mobile: "9876543210", email: "asha@example.com", role: "Supervisor", location: "Lucknow", experience: "5 years", resume: new File(["%PDF-1.4"], "asha cv.pdf"), consent: "on" });
    expect(r.status).toBe(200);
    const mail = JSON.parse(send.mock.calls[0][1].body);
    expect(mail.attachments).toEqual([{ filename: "asha cv.pdf", content: Buffer.from("%PDF-1.4").toString("base64") }]);
  });

  it("refuses invalid fields with a message for each, and sends nothing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const send = vi.spyOn(globalThis, "fetch");
    const r = await post({ ...contact, phone: "123", email: "nope" });
    expect(r.status).toBe(422);
    expect(Object.keys((await r.json()).errors)).toEqual(["phone", "email"]);
    expect(send).not.toHaveBeenCalled();
  });

  it("drops bots that fill the hidden field, and unknown forms", async () => {
    const send = vi.spyOn(globalThis, "fetch");
    expect((await post({ ...contact, website: "http://spam" })).status).toBe(200);
    expect((await post({ ...contact, form: "nope" })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("says so when Resend fails, and in production when no key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(contact)).status).toBe(502);
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await post(contact)).status).toBe(503);
  });
});
