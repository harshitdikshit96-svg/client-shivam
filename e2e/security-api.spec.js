// The HTTP API of the production build: who may call it, what it refuses, the security headers, and a full
// create → read → update → delete round of every record type. Runs after navigation.spec.js (which leaves one
// firm and changes the password); everything created here is deleted again at the end.
import { test, expect, request as pwRequest } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const USER = "e2e-owner";
let api;        // logged-in API client (no Origin header, like a script)
let anon;       // logged-out client

async function loginClient() {
  const ctx = await pwRequest.newContext({ baseURL: test.info().project.use.baseURL });
  for (const password of ["e2e-password-2", "e2e-password-1"]) {
    const r = await ctx.post("/api/session", { data: { username: USER, password } });
    if (r.ok()) return ctx;
  }
  throw new Error("could not log in");
}
const op = async (name, args = {}) => {
  const r = await api.post("/api/data", { data: { op: name, ...args } });
  return { status: r.status(), body: await r.json() };
};

test.beforeAll(async () => {
  api = await loginClient();
  anon = await pwRequest.newContext({ baseURL: test.info().project.use.baseURL });
});
test.afterAll(async () => { await api?.dispose(); await anon?.dispose(); });

// ---------------------------------------------------------------- access
test("logged out: every data call is refused with 401, nothing leaks", async () => {
  const get = await anon.get("/api/data");
  expect(get.status()).toBe(401);
  expect(await get.json()).toMatchObject({ loggedOut: true });
  const post = await anon.post("/api/data", { data: { op: "createFirm", values: { form: { name: "Intruder" } } } });
  expect(post.status()).toBe(401);
  expect((await (await anon.get("/api/session")).json())).toMatchObject({ loggedIn: false, username: null });
});

test("login cookie: HttpOnly, SameSite=Lax, Secure, whole site; a wrong password gives no cookie", async () => {
  const ctx = await pwRequest.newContext({ baseURL: test.info().project.use.baseURL });
  const bad = await ctx.post("/api/session", { data: { username: USER, password: "not-the-password" } });
  expect(bad.status()).toBe(400);
  expect(bad.headers()["set-cookie"]).toBeUndefined();
  let good;
  for (const password of ["e2e-password-2", "e2e-password-1"]) {
    good = await ctx.post("/api/session", { data: { username: USER, password } });
    if (good.ok()) break;
  }
  const cookie = good.headers()["set-cookie"];
  expect(cookie).toMatch(/^cp_session=/);
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=lax/i);
  expect(cookie).toMatch(/Secure/i);
  expect(cookie).toMatch(/Path=\//);
  // logout ends that session on the server, not just in the browser
  await ctx.delete("/api/session");
  expect((await ctx.get("/api/data")).status()).toBe(401);
  await ctx.dispose();
});

// ---------------------------------------------------------------- hardening
test("security headers on pages and API; no framework banner", async () => {
  for (const path of ["/", "/api/session"]) {
    const h = (await anon.get(path)).headers();
    expect(h["content-security-policy"], path).toMatch(/frame-ancestors 'none'/);
    expect(h["content-security-policy"], path).toMatch(/object-src 'none'/);
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("same-origin");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("cross-site requests are refused (CSRF): foreign Origin, form-style body, foreign logout", async () => {
  const foreign = await api.post("/api/data", { data: { op: "createFirm", values: { form: { name: "CSRF" } } }, headers: { Origin: "https://evil.example" } });
  expect(foreign.status()).toBe(403);
  const formBody = await api.post("/api/data", { data: JSON.stringify({ op: "createFirm", values: { form: { name: "CSRF" } } }), headers: { "Content-Type": "text/plain" } });
  expect(formBody.status()).toBe(415);
  expect((await api.delete("/api/session", { headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  const login = await anon.post("/api/session", { data: { username: USER, password: "x" }, headers: { Origin: "https://evil.example" } });
  expect(login.status()).toBe(403);
  expect((await op("getFirm")).status).not.toBe(401);   // still logged in
});

test("odd requests get a clear 4xx, never a crash or internals", async () => {
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty", "dropTables"]) {
    const r = await op(name);
    expect(r.status, name).toBe(400);
    expect(r.body.error, name).toMatch(/Unknown action/);
  }
  const broken = await api.post("/api/data", { data: "{not json", headers: { "Content-Type": "application/json" } });
  expect(broken.status()).toBe(400);
  const huge = await api.post("/api/data", { data: { op: "createFirm", values: { form: { name: "x".repeat(600 * 1024) } } } });
  expect(huge.status()).toBe(413);
  const odd = await api.get("/api/data?firm=1%20OR%201%3D1");
  expect(odd.status()).toBe(200);   // not a number → the default firm; never passed to SQL
});

test("the field-selection prototype is closed in this mode", async () => {
  expect((await anon.get("/api/config?k=change-me-client")).status()).toBe(404);
  expect((await anon.post("/api/submit", { data: { k: "change-me-client" } })).status()).toBe(404);
  expect((await anon.get("/review?a=change-me-admin")).status()).toBe(404);
});

// ---------------------------------------------------------------- CRUD over HTTP
const WO = (woNo, over = {}) => ({
  form: { woNo, workName: "API Sweeping", peName: "PE", start: "2026-06-01", peDesig: "Manager", end: "2027-03-31", company: "NEC", peContact: "9000000000", state: "Assam", district: "Tinsukia", ...over },
  statutory: { epfPercent: "12", esiPercent: "0.75", esiGrossCeiling: "21000", otMultiplier: "2", hoursPerDay: "8" },
  rates: { Unskilled: { basicDaily: "556" } },
});
const WM = (aadhaar, over = {}) => ({
  details: { aadhaar, name: "Api Worker", gender: "Male", relative: "Parent", dob: "1990-01-01", nationality: "Indian", doj: "2026-06-01", designation: "LABOUR", skill: "Unskilled", pfType: "EPF", bankAc: "000111222333", presentAddr: "Ledo", pwd: "No", exServ: "No", accommodation: "Self", ...over },
});

test("create → read → update → delete every record type, with the links checked at each step", async () => {
  // firm
  let r = await op("createFirm", { values: { form: { name: "API Test Firm", cuin: "API-1" } } });
  expect(r.status).toBe(200);
  const firmId = r.body.result.id;
  const call = (name, args = {}) => op(name, { firmId, ...args });
  expect((await call("updateFirm", { values: { form: { name: "API Test Firm Ltd", cuin: "API-1", pincode: "226010" } } })).status).toBe(200);
  expect((await call("getFirm")).body.result.form).toMatchObject({ name: "API Test Firm Ltd", pincode: "226010" });
  const dup = await op("createFirm", { values: { form: { name: "API Test Firm Ltd" } } });
  expect(dup).toMatchObject({ status: 400, body: { error: "A firm with this name already exists." } });   // no SQL in the message

  // work order + config + approve
  r = await call("createWorkOrder", { values: WO("API-WO-1") });
  const woId = r.body.result.id;
  expect((await call("getWorkOrder", { workOrderId: woId })).body.result.form.woNo).toBe("API-WO-1");
  expect((await call("updateWorkOrder", { workOrderId: woId, values: WO("API-WO-1A", { workName: "API Cleaning" }) })).status).toBe(200);
  expect((await call("setWorkOrderStatus", { workOrderId: woId, move: "approve" })).status).toBe(200);

  // workman + engagement + edit dates
  r = await call("createWorkman", { values: WM("123412341234") });
  const wmId = r.body.result.id;
  expect(r.body.result.wuin).toBe("WM00001");
  expect((await call("updateWorkman", { workmanId: wmId, values: WM("123412341234", { name: "Api Worker Two" }) })).status).toBe(200);
  expect((await call("engageWorkmen", { workOrderId: woId, rows: [{ workmanId: wmId, from: "2026-07-01" }] })).status).toBe(200);
  let data = await (await api.get(`/api/data?firm=${firmId}`)).json();
  const eng = data.engagements[0];
  expect(eng).toMatchObject({ woNo: "API-WO-1A", wuin: "WM00001", name: "Api Worker Two", to: null });
  expect(data.workOrders[0].workmenCount).toBe(1);
  expect((await call("editEngagement", { engagementId: eng.id, from: "2026-06-15", to: "" })).status).toBe(200);

  // wages: save, the D3 day limits, submit, reopen, delete
  r = await call("saveWages", { workOrderId: woId, year: 2026, month: 9, rows: [{ workmanId: wmId, daysWorked: "31" }] });
  expect(r.body.result.errors[wmId]).toMatch(/September 2026 has 30 days/);
  r = await call("saveWages", { workOrderId: woId, year: 2026, month: 9, rows: [{ workmanId: wmId, daysWorked: "26" }] });
  const sheetId = r.body.result.sheetId;
  data = await (await api.get(`/api/data?firm=${firmId}`)).json();
  expect(data.sheets[0].lines[0]).toMatchObject({ wuin: "WM00001", net: 12613 });
  expect((await call("submitWages", { sheetId })).status).toBe(200);
  expect((await call("deleteWages", { sheetId })).body.error).toMatch(/Reopen for Editing/);
  expect((await call("reopenWages", { sheetId })).status).toBe(200);

  // bill
  r = await call("saveBill", { values: { details: { wo: String(woId), partyName: "NEC", billNo: "API-B-1", billDate: "2026-10-01", taxable: "50000" } } });
  const billId = r.body.result.id;
  expect((await call("saveBill", { billId, values: { details: { wo: String(woId), partyName: "NEC", billNo: "API-B-1", billDate: "2026-10-01", taxable: "52000" } } })).status).toBe(200);

  // deletes refuse while records depend on each other, naming them …
  expect((await call("deleteFirm")).body.error).toMatch(/1 work order, 1 workman, 1 bill/);
  expect((await call("deleteWorkOrder", { workOrderId: woId })).body.error).toMatch(/1 engagement, 1 wage month, 1 bill/);
  expect((await call("deleteEngagement", { engagementId: eng.id })).body.error).toMatch(/26 days of wages/);
  // … and succeed in the right order
  for (const [name, args] of [["deleteBill", { billId }], ["deleteWages", { sheetId }], ["deleteEngagement", { engagementId: eng.id }],
    ["deleteWorkman", { workmanId: wmId }], ["deleteWorkOrder", { workOrderId: woId }], ["deleteFirm", {}]]) {
    const d = await call(name, args);
    expect(d.status, `${name}: ${d.body.error}`).toBe(200);
  }
  data = await (await api.get("/api/data")).json();
  expect(data.firms.map((f) => f.name)).not.toContain("API Test Firm Ltd");
});

test("firm isolation over HTTP: firm B's id cannot read or change firm A's records", async () => {
  const a = (await op("createFirm", { values: { form: { name: "API Firm A" } } })).body.result.id;
  const b = (await op("createFirm", { values: { form: { name: "API Firm B" } } })).body.result.id;
  const wo = (await op("createWorkOrder", { firmId: a, values: WO("ISO-1") })).body.result.id;
  for (const [name, args] of [["getWorkOrder", { workOrderId: wo }], ["updateWorkOrder", { workOrderId: wo, values: WO("HACK") }],
    ["setWorkOrderStatus", { workOrderId: wo, move: "approve" }], ["deleteWorkOrder", { workOrderId: wo }]]) {
    const r = await op(name, { firmId: b, ...args });
    expect(r.status, name).toBe(400);
  }
  expect((await (await api.get(`/api/data?firm=${b}`)).json()).workOrders).toHaveLength(0);
  await op("deleteWorkOrder", { firmId: a, workOrderId: wo });
  await op("deleteFirm", { firmId: a });
  await op("deleteFirm", { firmId: b });
});
