// Integrity beyond the test plan (docs/TEST-PLAN.md D1–D5 fixes): deleting records entered by mistake, clearing a
// wage row, and every edit that could leave engagements or wages stranded outside their dates.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "../helpers/db";
import { OPS, UserError } from "@/lib/ops";
import { RULES } from "@/lib/rules";
import { firmSnapshot } from "@/lib/data";

let t, db;
beforeEach(async () => { t = await createTestDb(); db = t.db; });
afterEach(async () => { await t.close(); });

const refused = async (p) => { try { await p; } catch (e) { expect(e).toBeInstanceOf(UserError); return e; } throw new Error("expected a refusal"); };
const ORDER = (woNo = "GEMC-1") => ({
  form: { woNo, workName: "Sweeping", peName: "PE", start: "2026-06-01", peDesig: "Manager", end: "2027-03-31", company: "NEC", peContact: "9000000000", state: "Assam", district: "Tinsukia" },
  statutory: { epfPercent: "12", esiPercent: "0.75", esiGrossCeiling: "21000", otMultiplier: "2", hoursPerDay: "8" },
  rates: { Unskilled: { basicDaily: "556" } },
});
const WORKMAN = (aadhaar = "123412341234", over = {}) => ({
  details: { aadhaar, name: "Ramesh", gender: "Male", relative: "Suresh", dob: "1990-01-01", nationality: "Indian", doj: "2026-06-01", designation: "LABOUR", skill: "Unskilled", pfType: "EPF", bankAc: "000111222333", presentAddr: "Ledo", pwd: "No", exServ: "No", accommodation: "Self", ...over },
});

async function setup({ approve = true } = {}) {
  const f = await OPS.createFirm(db, { values: { form: { name: "Firm" } } });
  const wo = await OPS.createWorkOrder(db, { firmId: f.id, values: ORDER() });
  if (approve) await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "approve" });
  const w = await OPS.createWorkman(db, { firmId: f.id, values: WORKMAN() });
  return { f, wo, w };
}
const engaged = async ({ f, wo, w }, from = "2026-07-01") => {
  await OPS.engageWorkmen(db, { firmId: f.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from }] });
  return (await firmSnapshot(db, f.id)).engagements[0];
};

describe("delete: allowed for records entered by mistake, refused (naming why) when something depends on them", () => {
  it("bill: deleted", async () => {
    const { f, wo } = await setup();
    const b = await OPS.saveBill(db, { firmId: f.id, values: { details: { wo: String(wo.id), partyName: "NEC", billNo: "B1", billDate: "2026-09-01", taxable: "100" } } });
    expect(await OPS.deleteBill(db, { firmId: f.id, billId: b.id })).toMatchObject({ billNumber: "B1" });
    expect((await firmSnapshot(db, f.id)).bills).toHaveLength(0);
  });
  it("engagement: refused while wages depend on it; deleted once the wages are removed", async () => {
    const s = await setup();
    const e = await engaged(s);
    const r = await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "20" }] });
    expect((await refused(OPS.deleteEngagement(db, { firmId: s.f.id, engagementId: e.id }))).message).toMatch(/20 days of wages on GEMC-1 in August 2026/);
    await OPS.deleteWages(db, { firmId: s.f.id, sheetId: r.sheetId });
    await OPS.deleteEngagement(db, { firmId: s.f.id, engagementId: e.id });
    expect((await firmSnapshot(db, s.f.id)).engagements).toHaveLength(0);
  });
  it("wage month: only a draft; a submitted month must be reopened first", async () => {
    const s = await setup();
    await engaged(s);
    const r = await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "20" }] });
    await OPS.submitWages(db, { firmId: s.f.id, sheetId: r.sheetId });
    expect((await refused(OPS.deleteWages(db, { firmId: s.f.id, sheetId: r.sheetId }))).message).toMatch(/Reopen for Editing/);
  });
  it("workman: refused with engagements (suggests Date of Exit); deleted when there is nothing linked", async () => {
    const s = await setup();
    const e = await engaged(s);
    const err = await refused(OPS.deleteWorkman(db, { firmId: s.f.id, workmanId: s.w.id }));
    expect(err.message).toMatch(/1 engagement.*Date of Exit/);
    expect(err.fix).toMatchObject({ to: "wm_view" });
    await OPS.deleteEngagement(db, { firmId: s.f.id, engagementId: e.id });
    await OPS.deleteWorkman(db, { firmId: s.f.id, workmanId: s.w.id });
    expect((await firmSnapshot(db, s.f.id)).workmen).toHaveLength(0);
  });
  it("work order: refused with engagements / bills; a fresh pending one (and its Config) is deleted", async () => {
    const s = await setup();
    await engaged(s);
    expect((await refused(OPS.deleteWorkOrder(db, { firmId: s.f.id, workOrderId: s.wo.id }))).message).toMatch(/1 engagement.*Mark Completed/);
    const pending = await OPS.createWorkOrder(db, { firmId: s.f.id, values: ORDER("GEMC-2") });
    await OPS.deleteWorkOrder(db, { firmId: s.f.id, workOrderId: pending.id });
    const { rows } = await t.client.query(`SELECT count(*)::int AS n FROM work_order_config WHERE work_order_id = ${pending.id}`);
    expect(rows[0].n).toBe(0);
  });
  it("firm: refused while it has records; an empty firm is deleted", async () => {
    const s = await setup();
    expect((await refused(OPS.deleteFirm(db, { firmId: s.f.id }))).message).toMatch(/1 work order, 1 workman/);
    const empty = await OPS.createFirm(db, { values: { form: { name: "Empty" } } });
    await OPS.deleteFirm(db, { firmId: empty.id });
    expect((await firmSnapshot(db, null)).firms.map((x) => x.name)).toEqual(["Firm"]);
  });
  it("another firm cannot delete anything of this firm", async () => {
    const s = await setup();
    const e = await engaged(s);
    const other = await OPS.createFirm(db, { values: { form: { name: "Other" } } });
    await refused(OPS.deleteWorkOrder(db, { firmId: other.id, workOrderId: s.wo.id }));
    await refused(OPS.deleteWorkman(db, { firmId: other.id, workmanId: s.w.id }));
    await refused(OPS.deleteEngagement(db, { firmId: other.id, engagementId: e.id }));
  });
});

describe("wage rows", () => {
  it("clearing Days Worked of a saved row removes it from the month", async () => {
    const s = await setup();
    await engaged(s);
    await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "20" }] });
    const r = await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "" }] });
    expect(r).toMatchObject({ saved: 0, removed: 1 });
    expect((await firmSnapshot(db, s.f.id)).sheets[0].lines).toHaveLength(0);
  });
  it("the days-within-engagement rule can be switched off (lib/rules.js)", async () => {
    const s = await setup();
    await engaged(s, "2026-08-21");
    const r = await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "26" }] });
    expect(r.errors[s.w.id]).toBe("26 days entered, but WM00001's engagement on GEMC-1 covers only 11 days of August 2026 (21/08/2026 to now). Enter at most 11, or correct the engagement dates (Edit, on the work order's page)");
    const before = RULES.wageDaysWithinEngagement;
    RULES.wageDaysWithinEngagement = false;
    try {
      expect((await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "26" }] })).saved).toBe(1);
    } finally { RULES.wageDaysWithinEngagement = before; }
    // the month's own length still applies
    expect((await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 9, rows: [{ workmanId: s.w.id, daysWorked: "31" }] })).errors[s.w.id]).toMatch(/September 2026 has 30 days/);
  });
});

describe("edits that would strand linked records are refused", () => {
  it("Mark Completed while a later month is already paid", async () => {
    const s = await setup();
    await engaged(s);
    await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2027, month: 2, rows: [{ workmanId: s.w.id, daysWorked: "20" }] });
    expect((await refused(OPS.setWorkOrderStatus(db, { firmId: s.f.id, workOrderId: s.wo.id, move: "complete" }))).message).toMatch(/cannot be completed.*February 2027/);
  });
  it("a date of exit before wages already paid", async () => {
    const s = await setup();
    await engaged(s);
    await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 9, rows: [{ workmanId: s.w.id, daysWorked: "20" }] });
    const e = await refused(OPS.updateWorkman(db, { firmId: s.f.id, workmanId: s.w.id, values: WORKMAN("123412341234", { exitDate: "2026-08-31" }) }));
    expect(e.fields["details.exitDate"]).toMatch(/September 2026/);
  });
  it("a date of joining after the first engagement started", async () => {
    const s = await setup();
    await engaged(s);
    const e = await refused(OPS.updateWorkman(db, { firmId: s.f.id, workmanId: s.w.id, values: WORKMAN("123412341234", { doj: "2026-08-01" }) }));
    expect(e.fields["details.doj"]).toMatch(/01\/07\/2026/);
  });
  it("order dates shortened past an engagement: the message names the workman", async () => {
    const s = await setup();
    await engaged(s);
    const values = { ...ORDER(), form: { ...ORDER().form, start: "2026-08-01" } };
    expect((await refused(OPS.updateWorkOrder(db, { firmId: s.f.id, workOrderId: s.wo.id, values }))).message).toMatch(/WM00001's engagement/);
  });
});

describe("Last Attendance Date", () => {
  it("is the end of the latest paid month, or the day the engagement ended if that is earlier", async () => {
    const s = await setup();
    const e = await engaged(s, "2026-08-01");
    await OPS.saveWages(db, { firmId: s.f.id, workOrderId: s.wo.id, year: 2026, month: 8, rows: [{ workmanId: s.w.id, daysWorked: "5" }] });
    expect((await firmSnapshot(db, s.f.id)).workmen[0].lastAtt).toBe("2026-08-31");
    await OPS.editEngagement(db, { firmId: s.f.id, engagementId: e.id, from: "2026-08-01", to: "2026-08-10" });
    expect((await firmSnapshot(db, s.f.id)).workmen[0].lastAtt).toBe("2026-08-10");
  });
});

describe("names", () => {
  it("names in Hindi (or any script) are accepted; digits are still refused", async () => {
    const f = await OPS.createFirm(db, { values: { form: { name: "Firm" } } });
    const w = await OPS.createWorkman(db, { firmId: f.id, values: WORKMAN("123412341234", { name: "रमेश", relative: "सुरेश कुमार" }) });
    expect(w.name).toBe("रमेश");
    await refused(OPS.createWorkman(db, { firmId: f.id, values: WORKMAN("999988887777", { name: "रमेश 2" }) }));
  });
});
