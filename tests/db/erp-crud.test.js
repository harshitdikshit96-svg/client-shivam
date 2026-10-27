// ERP test plan (docs/TEST-PLAN.md), service level: every create / read / update through lib/ops.js,
// the links firm → work order → engagement → workman → wages → bill, and what the screens read (firmSnapshot).
// Case ids match the plan. A failing case here is a defect in the app, not in the test.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { OPS, UserError, explainDbError } from "@/lib/ops";
import { firmSnapshot } from "@/lib/data";
import { engagements, wageLines } from "@/db/schema";

let t, db;
beforeEach(async () => { t = await createTestDb(); db = t.db; });
afterEach(async () => { await t.close(); });

const rejects = async (p) => {
  try { await p; } catch (e) {
    if (e instanceof UserError) return e;
    const u = explainDbError(e);
    if (u) return u;
    throw e;
  }
  throw new Error("expected the operation to be refused");
};

// ---------- fixtures ----------
const FIRM = (name = "Secure Eye", cuin = "CU-1") => ({ form: { name, cuin, pincode: "226010", mobile: "9876543210" } });
const ORDER = (woNo = "GEMC-1", over = {}, rate = "556") => ({
  form: {
    woNo, workName: "Sweeping", peName: "PE", start: "2026-06-01", peDesig: "Area Manager", end: "2027-03-31",
    company: "NEC", peContact: "9000000000", state: "Assam", district: "Tinsukia", ...over,
  },
  statutory: { epfPercent: "12", esiPercent: "0.75", esiGrossCeiling: "21000", otMultiplier: "2", hoursPerDay: "8", deadlineDay: "" },
  rates: { Unskilled: { basicDaily: rate } },
});
const WORKMAN = (aadhaar = "123412341234", over = {}) => ({
  details: {
    aadhaar, name: "Ramesh", surname: "Kumar", gender: "Male", relative: "Suresh", dob: "1990-01-01", nationality: "Indian",
    doj: "2026-06-01", designation: "LABOUR", skill: "Unskilled", pfType: "EPF", bankAc: "000111222333", presentAddr: "Margherita",
    pwd: "No", exServ: "No", accommodation: "Self", ...over,
  },
});

const EDIT = (woNo, over, rate) => ORDER(woNo, { svName: "Supervisor", svPhone: "9111111111", nature: "Watch and Ward", areaOp: "Surface", ...over }, rate);
const firm = (n = 1) => OPS.createFirm(db, { values: FIRM(`Firm ${n}`, `CU-${n}`) });
async function approvedOrder(firmId, woNo = "GEMC-1", over, rate) {
  const wo = await OPS.createWorkOrder(db, { firmId, values: ORDER(woNo, over, rate) });
  await OPS.setWorkOrderStatus(db, { firmId, workOrderId: wo.id, move: "approve" });
  return wo;
}
const workman = (firmId, aadhaar, over) => OPS.createWorkman(db, { firmId, values: WORKMAN(aadhaar, over) });
const engage = (firmId, workOrderId, workmanId, from) => OPS.engageWorkmen(db, { firmId, workOrderId, rows: [{ workmanId, from }] });
const wages = (firmId, workOrderId, month, rows, year = 2026) => OPS.saveWages(db, { firmId, workOrderId, year, month, rows });
const snap = (firmId) => firmSnapshot(db, firmId);
const openEngagements = async (workmanId) => (await db.select().from(engagements).where(eq(engagements.workmanId, workmanId))).filter((e) => !e.engagedTo);

/** One firm, one approved order, one workman engaged from 1 Jul 2026. */
async function base() {
  const f = await firm(1);
  const wo = await approvedOrder(f.id);
  const w = await workman(f.id);
  await engage(f.id, wo.id, w.id, "2026-07-01");
  return { f, wo, w };
}

// =====================================================================================================
describe("FIRM — create, read, update", () => {
  it("F-01 a created firm is listed and selected in the views", async () => {
    const f = await firm(1);
    const s = await snap(f.id);
    expect(s.firms).toEqual([expect.objectContaining({ id: f.id, name: "Firm 1", cuin: "CU-1" })]);
    expect(s.firm.id).toBe(f.id);
  });
  it("F-02 the firm name is required", async () => {
    const e = await rejects(OPS.createFirm(db, { values: { form: { cuin: "X" } } }));
    expect(e.fields).toHaveProperty("form.name");
  });
  it("F-03 two firms cannot share a name or a CUIN", async () => {
    await firm(1);
    await rejects(OPS.createFirm(db, { values: FIRM("Firm 1", "CU-9") }));
    await rejects(OPS.createFirm(db, { values: FIRM("Another", "CU-1") }));
    expect((await snap(null)).firms).toHaveLength(1);
  });
  it("F-04 wrong mobile / pincode formats are refused per field", async () => {
    const e = await rejects(OPS.createFirm(db, { values: { form: { name: "X", mobile: "12345", pincode: "22" } } }));
    expect(Object.keys(e.fields)).toEqual(expect.arrayContaining(["form.mobile", "form.pincode"]));
  });
  it("F-05 the edit form loads the saved values and an update shows everywhere", async () => {
    const f = await firm(1);
    const form = await OPS.getFirm(db, { firmId: f.id });
    expect(form["form.name"] ?? form.form?.name).toBe("Firm 1");
    await OPS.updateFirm(db, { firmId: f.id, values: { form: { ...FIRM().form, name: "Firm One Renamed", cuin: "CU-1" } } });
    const wo = await approvedOrder(f.id);
    const s = await snap(f.id);
    expect(s.firm.name).toBe("Firm One Renamed");
    expect(s.workOrders.find((o) => o.id === wo.id).firm).toBe("Firm One Renamed");
  });
});

// =====================================================================================================
describe("WORK ORDER — create under a firm, config, edit, status", () => {
  it("WO-01 a new order is saved under the selected firm, pending, with its Config", async () => {
    const f = await firm(1);
    const wo = await OPS.createWorkOrder(db, { firmId: f.id, values: ORDER() });
    expect(wo.firmId).toBe(f.id);
    const row = (await snap(f.id)).workOrders[0];
    expect(row).toMatchObject({ woNo: "GEMC-1", status: "pending", firm: "Firm 1", workmenCount: 0, start: "2026-06-01", end: "2027-03-31" });
    expect(row.config.rates.Unskilled.basicDaily).toBe(556);
    expect(row.config.statutory).toMatchObject({ epfPercent: 12, esiPercent: 0.75 });
  });
  it("WO-02 the order number is unique within a firm, but another firm may reuse it", async () => {
    const a = await firm(1); const b = await firm(2);
    await OPS.createWorkOrder(db, { firmId: a.id, values: ORDER() });
    await rejects(OPS.createWorkOrder(db, { firmId: a.id, values: ORDER() }));
    await OPS.createWorkOrder(db, { firmId: b.id, values: ORDER() });
    expect((await snap(a.id)).workOrders).toHaveLength(1);
    expect((await snap(b.id)).workOrders).toHaveLength(1);
  });
  it("WO-03 completion before commencement, and an order without any Per Day Wage, are refused", async () => {
    const f = await firm(1);
    const e1 = await rejects(OPS.createWorkOrder(db, { firmId: f.id, values: ORDER("A", { end: "2026-01-01" }) }));
    expect(e1.fields).toHaveProperty("form.end");
    const noRate = ORDER("B"); noRate.rates = {};
    const e2 = await rejects(OPS.createWorkOrder(db, { firmId: f.id, values: noRate }));
    expect(e2.fields).toHaveProperty("rates.Unskilled");
    expect((await snap(f.id)).workOrders).toHaveLength(0);   // nothing half-saved
  });
  it("WO-04 the edit form loads the saved order and an edit is reflected in the list", async () => {
    const f = await firm(1);
    const wo = await approvedOrder(f.id);
    const got = await OPS.getWorkOrder(db, { firmId: f.id, workOrderId: wo.id });
    expect(JSON.stringify(got)).toContain("GEMC-1");
    const before = (await snap(f.id)).workOrders[0].updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await OPS.updateWorkOrder(db, { firmId: f.id, workOrderId: wo.id, values: EDIT("GEMC-1A", { workName: "Sweeping & Cleaning", end: "2027-06-30" }, "600") }).catch((e) => { throw new Error(JSON.stringify(e.fields)); });
    const row = (await snap(f.id)).workOrders[0];
    expect(row).toMatchObject({ woNo: "GEMC-1A", workName: "Sweeping & Cleaning", end: "2027-06-30", status: "approved" });
    expect(row.config.rates.Unskilled.basicDaily).toBe(600);
    expect(row.updatedAt > before).toBe(true);
  });
  it("WO-05 Config change recalculates draft wages but never a submitted month", async () => {
    const { f, wo, w } = await base();
    await wages(f.id, wo.id, 7, [{ workmanId: w.id, daysWorked: "26" }]);
    const aug = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    await OPS.submitWages(db, { firmId: f.id, sheetId: aug.sheetId });
    await OPS.saveConfig(db, { firmId: f.id, workOrderId: wo.id, values: ORDER("GEMC-1", {}, "600") });
    const s = await snap(f.id);
    const jul = s.sheets.find((x) => x.month === 7).lines[0];
    const augL = s.sheets.find((x) => x.month === 8).lines[0];
    expect(jul.basic).toBe(600);
    expect(augL.basic).toBe(556);
    expect(augL.net).toBe(12613);
  });
  it("WO-06 status moves: only the allowed ones; completing ends current engagements", async () => {
    const f = await firm(1);
    const wo = await OPS.createWorkOrder(db, { firmId: f.id, values: ORDER() });
    for (const m of ["complete", "reopen", "resubmit"]) await rejects(OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: m }));
    await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "reject" });
    await rejects(OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "approve" }));
    await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "resubmit" });
    await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "approve" });
    const w = await workman(f.id);
    await engage(f.id, wo.id, w.id, "2026-07-01");
    const done = await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "complete" });
    expect(done.ended).toBe(1);
    const s = await snap(f.id);
    expect(s.workOrders[0]).toMatchObject({ status: "completed", workmenCount: 0 });
    expect(s.workmen[0].status).toBe("Inactive");
    await rejects(engage(f.id, wo.id, w.id, "2026-08-01"));
    await rejects(OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "bogus" }));
  });
  it("WO-07 workmen cannot be engaged on a pending or rejected order", async () => {
    const f = await firm(1);
    const wo = await OPS.createWorkOrder(db, { firmId: f.id, values: ORDER() });
    const w = await workman(f.id);
    expect((await rejects(engage(f.id, wo.id, w.id, "2026-07-01"))).message).toMatch(/waiting for approval/);
    await OPS.setWorkOrderStatus(db, { firmId: f.id, workOrderId: wo.id, move: "reject" });
    expect((await rejects(engage(f.id, wo.id, w.id, "2026-07-01"))).message).toMatch(/rejected/);
  });
  it("WO-08 dates of an order cannot be shortened so that existing engagements / wages fall outside it", async () => {
    const { f, wo, w } = await base();
    await wages(f.id, wo.id, 7, [{ workmanId: w.id, daysWorked: "20" }]);
    await rejects(OPS.updateWorkOrder(db, { firmId: f.id, workOrderId: wo.id, values: EDIT("GEMC-1", { start: "2026-09-01" }) }));
    expect((await snap(f.id)).workOrders[0].start).toBe("2026-06-01");
  });
});

// =====================================================================================================
describe("WORKMAN — create, read, update, exit", () => {
  it("WM-01 WUINs run WM00001, WM00002… per firm; the new workman is listed as Inactive (not engaged)", async () => {
    const a = await firm(1); const b = await firm(2);
    const w1 = await workman(a.id, "111111111111");
    const w2 = await workman(a.id, "222222222222");
    const w3 = await workman(b.id, "333333333333");
    expect([w1.wuin, w2.wuin, w3.wuin]).toEqual(["WM00001", "WM00002", "WM00001"]);
    expect((await snap(a.id)).workmen.map((w) => [w.wuin, w.status, w.engagedIn])).toEqual([["WM00001", "Inactive", null], ["WM00002", "Inactive", null]]);
  });
  it("WM-02 the same Aadhaar twice in a firm is refused (names the WUIN); another firm may have it", async () => {
    const a = await firm(1); const b = await firm(2);
    await workman(a.id);
    const e = await rejects(workman(a.id));
    expect(e.message).toMatch(/WM00001/);
    await workman(b.id);
  });
  it("WM-03 required fields, under-18 on joining, future DOB and bad Aadhaar are refused", async () => {
    const f = await firm(1);
    expect((await rejects(workman(f.id, "", {}))).fields).toHaveProperty("details.aadhaar");
    expect((await rejects(workman(f.id, "1234", {}))).fields).toHaveProperty("details.aadhaar");
    expect((await rejects(workman(f.id, undefined, { dob: "2015-01-01" }))).fields).toHaveProperty("details.doj");
    expect((await rejects(workman(f.id, undefined, { dob: "2099-01-01" }))).fields).toHaveProperty("details.dob");
    expect((await snap(f.id)).workmen).toHaveLength(0);
  });
  it("WM-04 the edit form loads the saved workman; edits show in the lists and the wage lines", async () => {
    const { f, wo, w } = await base();
    const got = await OPS.getWorkman(db, { firmId: f.id, workmanId: w.id });
    expect(got.wuin).toBe("WM00001");
    expect(JSON.stringify(got.values)).toContain("123412341234");
    await OPS.updateWorkman(db, { firmId: f.id, workmanId: w.id, values: WORKMAN("123412341234", { name: "Ramesh Chandra", mobile: "9123456789" }) });
    await wages(f.id, wo.id, 7, [{ workmanId: w.id, daysWorked: "10" }]);
    const s = await snap(f.id);
    expect(s.workmen[0]).toMatchObject({ fullName: "Ramesh Chandra Kumar", mobile: "9123456789", wuin: "WM00001" });
    expect(s.engagements[0].name).toBe("Ramesh Chandra Kumar");
    expect(s.sheets[0].lines[0].name).toBe("Ramesh Chandra Kumar");
  });
  it("WM-05 a date of exit ends the current engagement and the workman shows as Moved out", async () => {
    const { f, wo, w } = await base();
    await OPS.updateWorkman(db, { firmId: f.id, workmanId: w.id, values: WORKMAN(undefined, { exitDate: "2026-08-15" }) });
    const s = await snap(f.id);
    expect(s.workmen[0]).toMatchObject({ status: "Moved out", exitDate: "2026-08-15" });
    expect(s.engagements[0]).toMatchObject({ to: "2026-08-15", status: "Ended" });
    expect(s.workOrders[0].workmenCount).toBe(0);
    await rejects(engage(f.id, wo.id, w.id, "2026-09-01"));
  });
  it("WM-06 a date of exit before the current engagement started is refused", async () => {
    const { f, w } = await base();
    await rejects(OPS.updateWorkman(db, { firmId: f.id, workmanId: w.id, values: WORKMAN(undefined, { exitDate: "2026-06-15" }) }));
  });
  it("WM-07 Bulk Accommodation updates only the ticked workmen of this firm", async () => {
    const a = await firm(1); const b = await firm(2);
    const w1 = await workman(a.id, "111111111111");
    const w2 = await workman(a.id, "222222222222");
    const other = await workman(b.id, "333333333333");
    const r = await OPS.setAccommodation(db, { firmId: a.id, workmanIds: [w1.id, other.id], accommodation: "Company Quarter" });
    expect(r.updated).toBe(1);
    const s = await snap(a.id);
    expect(s.workmen.find((w) => w.id === w1.id).accommodation).toBe("Company Quarter");
    expect(s.workmen.find((w) => w.id === w2.id).accommodation).toBe("Self");
    expect((await snap(b.id)).workmen[0].accommodation).toBe("Self");
  });
});

// =====================================================================================================
describe("ENGAGEMENT — a workman is on at most one work order at any time", () => {
  it("EN-01 engaging links workman ↔ order in every view", async () => {
    const { f, wo } = await base();
    const s = await snap(f.id);
    expect(s.engagements).toEqual([expect.objectContaining({ woNo: "GEMC-1", wuin: "WM00001", from: "2026-07-01", to: null, status: "Current", workOrderId: wo.id })]);
    expect(s.workmen[0]).toMatchObject({ status: "Active", engagedIn: "GEMC-1", currentWoId: wo.id, engagedFrom: "2026-07-01" });
    expect(s.workOrders[0].workmenCount).toBe(1);
  });
  it("EN-02 engaging on a second order moves the workman: the first ends the day before", async () => {
    const { f, w } = await base();
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    const r = await engage(f.id, wo2.id, w.id, "2026-08-16");
    expect(r).toMatchObject({ engaged: 1, moved: 1 });
    const s = await snap(f.id);
    expect(s.engagements.map((e) => [e.woNo, e.from, e.to])).toEqual([["GEMC-1", "2026-07-01", "2026-08-15"], ["GEMC-2", "2026-08-16", null]]);
    expect(s.workmen[0]).toMatchObject({ engagedIn: "GEMC-2", status: "Active" });
    expect(s.workOrders.map((o) => [o.woNo, o.workmenCount])).toEqual([["GEMC-1", 0], ["GEMC-2", 1]]);
    expect(await openEngagements(w.id)).toHaveLength(1);
  });
  it("EN-03 engaging again on the same order, or moving to a date not after the current start, is refused", async () => {
    const { f, wo, w } = await base();
    expect(JSON.stringify((await rejects(engage(f.id, wo.id, w.id, "2026-08-01"))).fields)).toMatch(/already engaged/);
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    await rejects(engage(f.id, wo2.id, w.id, "2026-07-01"));
    await rejects(engage(f.id, wo2.id, w.id, "2026-06-15"));
  });
  it("EN-04 the database itself refuses two current engagements for one workman", async () => {
    const { f, w } = await base();
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    await expect(db.insert(engagements).values({ firmId: f.id, workmanId: w.id, workOrderId: wo2.id, engagedFrom: "2026-09-01" })).rejects.toThrow();
  });
  it("EN-05 the same workman ticked twice in one Engage is refused cleanly (one engagement, no crash)", async () => {
    const f = await firm(1);
    const wo = await approvedOrder(f.id);
    const w = await workman(f.id);
    const e = await rejects(OPS.engageWorkmen(db, { firmId: f.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }, { workmanId: w.id, from: "2026-07-05" }] }));
    expect(e).toBeInstanceOf(UserError);
    expect((await snap(f.id)).engagements.length).toBeLessThanOrEqual(1);
  });
  it("EN-06 a back-dated engagement may not overlap an ENDED engagement on another order", async () => {
    const { f, wo, w } = await base();
    const ended = (await snap(f.id)).engagements[0];
    await OPS.endEngagement(db, { firmId: f.id, engagementId: ended.id, to: "2026-08-31" });
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    // 15 Aug is inside 1 Jul – 31 Aug on GEMC-1: the workman would be on two orders at once
    await rejects(engage(f.id, wo2.id, w.id, "2026-08-15"));
    expect((await snap(f.id)).engagements.filter((e) => e.workOrderId !== wo.id)).toHaveLength(0);
  });
  it("EN-07 correcting engagement dates may not create an overlap with another order", async () => {
    const { f, w } = await base();
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    await engage(f.id, wo2.id, w.id, "2026-09-01");   // GEMC-1: 1 Jul–31 Aug, GEMC-2: from 1 Sep
    const first = (await snap(f.id)).engagements.find((e) => e.woNo === "GEMC-1");
    await rejects(OPS.editEngagement(db, { firmId: f.id, engagementId: first.id, from: "2026-07-01", to: "2026-10-31" }));
    const again = (await snap(f.id)).engagements.find((e) => e.woNo === "GEMC-1");
    expect(again.to).toBe("2026-08-31");
  });
  it("EN-08 correcting engagement dates keeps the same rules as engaging (order dates, date of joining)", async () => {
    const { f } = await base();
    const e = (await snap(f.id)).engagements[0];
    await rejects(OPS.editEngagement(db, { firmId: f.id, engagementId: e.id, from: "2026-05-01", to: "" }));   // before order start & joining
    await rejects(OPS.editEngagement(db, { firmId: f.id, engagementId: e.id, from: "2026-07-01", to: "2027-12-31" }));   // after order end
  });
  it("EN-09 an engagement cannot be shortened so that saved wages fall outside it", async () => {
    const { f, wo, w } = await base();
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    const e = (await snap(f.id)).engagements[0];
    await rejects(OPS.endEngagement(db, { firmId: f.id, engagementId: e.id, to: "2026-07-31" }));
  });
  it("EN-10 end date before start, or ending twice, is refused; a valid end shows as Ended", async () => {
    const { f } = await base();
    const e = (await snap(f.id)).engagements[0];
    await rejects(OPS.endEngagement(db, { firmId: f.id, engagementId: e.id, to: "2026-06-30" }));
    await OPS.endEngagement(db, { firmId: f.id, engagementId: e.id, to: "2026-09-30" });
    await rejects(OPS.endEngagement(db, { firmId: f.id, engagementId: e.id, to: "2026-10-30" }));
    const s = await snap(f.id);
    expect(s.engagements[0]).toMatchObject({ status: "Ended", to: "2026-09-30" });
    expect(s.workmen[0]).toMatchObject({ status: "Inactive", engagedIn: "GEMC-1" });
  });
  it("EN-11 engagement outside the order dates or before joining is refused; one bad row saves nothing", async () => {
    const f = await firm(1);
    const wo = await approvedOrder(f.id);
    const ok = await workman(f.id, "111111111111");
    const late = await workman(f.id, "222222222222", { doj: "2026-09-01" });
    await rejects(engage(f.id, wo.id, ok.id, "2027-05-01"));
    await rejects(OPS.engageWorkmen(db, { firmId: f.id, workOrderId: wo.id, rows: [{ workmanId: ok.id, from: "2026-07-01" }, { workmanId: late.id, from: "2026-07-01" }] }));
    expect((await snap(f.id)).engagements).toHaveLength(0);
  });
});

// =====================================================================================================
describe("WAGES — days typed, everything else calculated", () => {
  it("WG-01 26 days at ₹556 → net ₹12,613, visible under the order and the workman", async () => {
    const { f, wo, w } = await base();
    const r = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    expect(r).toMatchObject({ saved: 1, errors: {} });
    const sheet = (await snap(f.id)).sheets[0];
    expect(sheet).toMatchObject({ woNo: "GEMC-1", workOrderId: wo.id, month: 8, year: 2026, status: "draft", workmenCount: 1, net: 12613 });
    expect(sheet.lines[0]).toMatchObject({ wuin: "WM00001", attDays: 26, basic: 556, gross: 14456, epf: 1735, esi: 108, net: 12613 });
    expect((await snap(f.id)).workmen[0].lastAtt).toBe("2026-08-31");
  });
  it("WG-02 saving again updates the line (never a duplicate)", async () => {
    const { f, wo, w } = await base();
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "21" }]);
    const s = await snap(f.id);
    expect(s.sheets).toHaveLength(1);
    expect(s.sheets[0].lines).toHaveLength(1);
    expect(s.sheets[0].lines[0].net).toBe(10187);
  });
  it("WG-03 a workman not engaged on the order that month gets a row error, nothing saved for him", async () => {
    const { f, wo } = await base();
    const idle = await workman(f.id, "999999999999");
    const r = await wages(f.id, wo.id, 8, [{ workmanId: idle.id, daysWorked: "10" }]);
    expect(r.saved).toBe(0);
    expect(r.errors[idle.id]).toMatch(/not engaged/);
  });
  it("WG-04 days worked cannot exceed the days in the month (30 in September)", async () => {
    const { f, wo, w } = await base();
    const r = await wages(f.id, wo.id, 9, [{ workmanId: w.id, daysWorked: "31" }]);
    expect(r.saved).toBe(0);
  });
  it("WG-05 days worked cannot exceed the days the workman was engaged on that order in the month", async () => {
    const f = await firm(1);
    const wo = await approvedOrder(f.id);
    const w = await workman(f.id);
    await engage(f.id, wo.id, w.id, "2026-08-21");   // 11 days in August
    const r = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    expect(r.saved).toBe(0);
  });
  it("WG-06 a workman moved mid-month cannot be paid more days than the month has across both orders", async () => {
    const { f, wo, w } = await base();
    const wo2 = await approvedOrder(f.id, "GEMC-2");
    await engage(f.id, wo2.id, w.id, "2026-08-16");
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "15" }]);
    const r = await wages(f.id, wo2.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);   // 15 + 26 = 41 days in August
    expect(r.saved).toBe(0);
  });
  it("WG-07 bad numbers are row errors: negative, text, OT minutes not in quarter hours", async () => {
    const { f, wo, w } = await base();
    for (const row of [{ daysWorked: "-1" }, { daysWorked: "abc" }, { daysWorked: "10", otMinutes: "20" }]) {
      const r = await wages(f.id, wo.id, 8, [{ workmanId: w.id, ...row }]);
      expect(r.saved, JSON.stringify(row)).toBe(0);
    }
    expect((await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "12.5" }])).saved).toBe(1);
  });
  it("WG-08 month outside the order dates, and an order of another firm, are refused", async () => {
    const { f, wo, w } = await base();
    await rejects(wages(f.id, wo.id, 4, [{ workmanId: w.id, daysWorked: "10" }]));
    const other = await firm(2);
    await rejects(wages(other.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "10" }]));
  });
  it("WG-09 submit locks, approve needs submit, reopen makes it editable again", async () => {
    const { f, wo, w } = await base();
    const { sheetId } = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    await rejects(OPS.approveWages(db, { firmId: f.id, sheetId }));
    await OPS.submitWages(db, { firmId: f.id, sheetId });
    await rejects(wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "20" }]));
    await rejects(OPS.submitWages(db, { firmId: f.id, sheetId }));
    await OPS.approveWages(db, { firmId: f.id, sheetId });
    expect((await snap(f.id)).sheets[0].status).toBe("approved");
    await OPS.reopenWages(db, { firmId: f.id, sheetId });
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "20" }]);
    expect((await snap(f.id)).sheets[0]).toMatchObject({ status: "draft", submittedAt: null });
  });
  it("WG-10 another firm cannot submit / approve / reopen this firm's wages", async () => {
    const { f, wo, w } = await base();
    const { sheetId } = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    const other = await firm(2);
    for (const op of ["submitWages", "approveWages", "reopenWages"]) await rejects(OPS[op](db, { firmId: other.id, sheetId }));
  });
  it("WG-11 every saved line: net = gross − deductions; sheet totals = sum of lines", async () => {
    const { f, wo, w } = await base();
    const w2 = await workman(f.id, "222222222222");
    await engage(f.id, wo.id, w2.id, "2026-07-01");
    await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "25", otHours: "3", otMinutes: "30", bonus: "100" }, { workmanId: w2.id, daysWorked: "7.5", damageRecovery: "50" }]);
    const s = (await snap(f.id)).sheets[0];
    for (const l of s.lines) expect(l.net).toBeCloseTo(l.gross - l.totalDed, 2);
    expect(s.net).toBeCloseTo(s.lines.reduce((t, l) => t + l.net, 0), 2);
    expect(s.gross).toBeCloseTo(s.lines.reduce((t, l) => t + l.gross, 0), 2);
  });
  it("WG-12 a line keeps the rates it was calculated with (config snapshot)", async () => {
    const { f, wo, w } = await base();
    const { sheetId } = await wages(f.id, wo.id, 8, [{ workmanId: w.id, daysWorked: "26" }]);
    await OPS.submitWages(db, { firmId: f.id, sheetId });
    await OPS.saveConfig(db, { firmId: f.id, workOrderId: wo.id, values: ORDER("GEMC-1", {}, "700") });
    const [line] = await db.select().from(wageLines).where(eq(wageLines.sheetId, sheetId));
    expect(Number(line.basicRate)).toBe(556);
  });
});

// =====================================================================================================
describe("DISPATCH REGISTER — bills linked to an order", () => {
  const BILL = (wo, over = {}) => ({ details: { wo: wo ? String(wo) : "", partyName: "NEC", billNo: "B-1", billDate: "2026-09-01", taxable: "100000", gst: "18000", ...over } });
  it("BL-01 a bill is created, listed with its order number, then edited", async () => {
    const { f, wo } = await base();
    const b = await OPS.saveBill(db, { firmId: f.id, values: BILL(wo.id) });
    expect((await snap(f.id)).bills[0]).toMatchObject({ woNo: "GEMC-1", billNo: "B-1", taxable: 100000, gst: 18000, approved: "No" });
    const got = await OPS.getBill(db, { firmId: f.id, billId: b.id });
    expect(JSON.stringify(got)).toContain("B-1");
    await OPS.saveBill(db, { firmId: f.id, billId: b.id, values: BILL(wo.id, { received: "110000", receivedDate: "2026-09-20", remark: "Paid" }) });
    const s = await snap(f.id);
    expect(s.bills).toHaveLength(1);
    expect(s.bills[0]).toMatchObject({ received: 110000, receivedDate: "2026-09-20", remark: "Paid" });
  });
  it("BL-02 bill number unique per firm; negative amounts refused", async () => {
    const { f, wo } = await base();
    await OPS.saveBill(db, { firmId: f.id, values: BILL(wo.id) });
    await rejects(OPS.saveBill(db, { firmId: f.id, values: BILL(wo.id) }));
    await rejects(OPS.saveBill(db, { firmId: f.id, values: BILL(wo.id, { billNo: "B-2", taxable: "-5" }) }));
  });
  it("BL-03 a bill cannot point at another firm's order, nor be edited from another firm", async () => {
    const { f, wo } = await base();
    const other = await firm(2);
    await rejects(OPS.saveBill(db, { firmId: other.id, values: BILL(wo.id) }));
    const b = await OPS.saveBill(db, { firmId: f.id, values: BILL(wo.id) });
    await rejects(OPS.saveBill(db, { firmId: other.id, billId: b.id, values: BILL(null, { billNo: "X" }) }));
    await rejects(OPS.getBill(db, { firmId: other.id, billId: b.id }));
  });
});

// =====================================================================================================
describe("FIRM ISOLATION — nothing crosses from one firm to another", () => {
  it("IS-01 another firm cannot read or change this firm's order, workman or engagement", async () => {
    const { f, wo, w } = await base();
    const o = await firm(2);
    const eng = (await snap(f.id)).engagements[0];
    await rejects(OPS.getWorkOrder(db, { firmId: o.id, workOrderId: wo.id }));
    await rejects(OPS.updateWorkOrder(db, { firmId: o.id, workOrderId: wo.id, values: EDIT("HACK") }));
    await rejects(OPS.saveConfig(db, { firmId: o.id, workOrderId: wo.id, values: ORDER() }));
    await rejects(OPS.setWorkOrderStatus(db, { firmId: o.id, workOrderId: wo.id, move: "complete" }));
    await rejects(OPS.getWorkman(db, { firmId: o.id, workmanId: w.id }));
    await rejects(OPS.updateWorkman(db, { firmId: o.id, workmanId: w.id, values: WORKMAN() }));
    await rejects(OPS.editEngagement(db, { firmId: o.id, engagementId: eng.id, from: "2026-07-01", to: "" }));
    await rejects(OPS.endEngagement(db, { firmId: o.id, engagementId: eng.id, to: "2026-09-01" }));
  });
  it("IS-02 a workman of firm B cannot be engaged on firm A's order", async () => {
    const a = await firm(1);
    const wo = await approvedOrder(a.id);
    const b = await firm(2);
    const wb = await workman(b.id);
    await rejects(engage(a.id, wo.id, wb.id, "2026-07-01"));
    await rejects(engage(b.id, wo.id, wb.id, "2026-07-01"));
    await expect(db.insert(engagements).values({ firmId: a.id, workmanId: wb.id, workOrderId: wo.id, engagedFrom: "2026-07-01" })).rejects.toThrow();
  });
  it("IS-03 each firm's views show only its own records", async () => {
    const { f } = await base();
    const o = await firm(2);
    const s = await snap(o.id);
    expect(s.firm.id).toBe(o.id);
    expect([s.workOrders, s.workmen, s.engagements, s.sheets, s.bills].every((x) => x.length === 0)).toBe(true);
    expect((await snap(f.id)).workOrders).toHaveLength(1);
  });
});

// =====================================================================================================
describe("SANITY — what any ERP should get right", () => {
  it("SN-01 text that looks like SQL or HTML is stored and shown literally", async () => {
    const f = await firm(1);
    const name = "Robert'); DROP TABLE work_orders;--";
    await OPS.createWorkOrder(db, { firmId: f.id, values: ORDER("WO-1", { workName: name, remarks: "<script>alert(1)</script>" }) });
    const s = await snap(f.id);
    expect(s.workOrders[0]).toMatchObject({ workName: name, remarks: "<script>alert(1)</script>" });
  });
  it("SN-02 impossible calendar dates are refused", async () => {
    const f = await firm(1);
    await rejects(OPS.createWorkOrder(db, { firmId: f.id, values: ORDER("X", { start: "2026-02-30" }) }));
    await rejects(workman(f.id, undefined, { doj: "2026-13-01" }));
  });
  it("SN-03 ids that do not exist give a clear message, not a crash", async () => {
    const f = await firm(1);
    await rejects(OPS.getWorkOrder(db, { firmId: f.id, workOrderId: 999 }));
    await rejects(OPS.getWorkman(db, { firmId: f.id, workmanId: 999 }));
    await rejects(OPS.endEngagement(db, { firmId: f.id, engagementId: 999, to: "2026-01-01" }));
    await rejects(OPS.submitWages(db, { firmId: f.id, sheetId: 999 }));
    await rejects(OPS.getFirm(db, { firmId: 999 }));
  });
  it("SN-04 records can be removed (or cancelled) when entered by mistake", () => {
    const missing = ["deleteFirm", "deleteWorkOrder", "deleteWorkman", "deleteEngagement", "deleteWages", "deleteBill"].filter((k) => !OPS[k]);
    expect(missing, `no delete/cancel operation for: ${missing.join(", ")}`).toEqual([]);
  });
});
