// What every button on the screens does to the data (lib/ops.js), including the messages users see when
// something is missing or wrong. Each message should say what the problem is and, where possible, how to fix it.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { OPS, UserError, explainDbError } from "@/lib/ops";
import { RULES } from "@/lib/rules";
import { firmSnapshot } from "@/lib/data";
import { engagements, workmen, firms } from "@/db/schema";

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

const FIRM = { form: { name: "Secure Eye", cuin: "CU-1", pincode: "226010", mobile: "9876543210" } };
const ORDER = {
  form: {
    woNo: "GEMC-1", workName: "Sweeping", peName: "PE", start: "2026-06-01", peDesig: "Area Manager", end: "2027-03-31",
    company: "NEC", peContact: "9000000000", state: "Assam", district: "Tinsukia",
  },
  statutory: { epfPercent: "12", esiPercent: "0.75", esiGrossCeiling: "21000", otMultiplier: "2", hoursPerDay: "8", deadlineDay: "" },
  rates: { Unskilled: { basicDaily: "556" } },
};
const WORKMAN = (aadhaar = "123412341234", over = {}) => ({
  details: {
    aadhaar, name: "Ramesh", surname: "Kumar", gender: "Male", relative: "Suresh", dob: "1990-01-01", nationality: "Indian",
    doj: "2026-06-01", designation: "LABOUR", skill: "Unskilled", pfType: "EPF", bankAc: "000111222333", presentAddr: "Margherita",
    pwd: "No", exServ: "No", accommodation: "Self", ...over,
  },
});

async function setup() {
  const firm = await OPS.createFirm(db, { values: FIRM });
  const wo = await OPS.createWorkOrder(db, { firmId: firm.id, values: ORDER });
  return { firm, wo };
}

describe("empty database: every action explains what to do first", () => {
  it("creating a work order without a firm points to Create Firm", async () => {
    const e = await rejects(OPS.createWorkOrder(db, { firmId: null, values: ORDER }));
    expect(e.message).toMatch(/Create a firm first/);
    expect(e.fix).toMatchObject({ to: "create_firm" });
  });
  it("adding a workman without a firm points to Create Firm", async () => {
    const e = await rejects(OPS.createWorkman(db, { firmId: null, values: WORKMAN() }));
    expect(e.fix?.to).toBe("create_firm");
  });
  it("engaging without choosing a work order says so", async () => {
    const { firm } = await setup();
    const e = await rejects(OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: null, rows: [] }));
    expect(e.message).toMatch(/Select the work order/);
  });
  it("saving wages with nothing typed says so", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const e = await rejects(OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [] }));
    expect(e.message).toMatch(/Type the Days Worked/);
  });
  it("reset password without a login explains how to set one up", async () => {
    const e = await rejects(OPS.resetPassword(db, { values: { form: { current: "x", new: "long-enough-pw", confirm: "long-enough-pw" } } }));
    expect(e.message).toMatch(/No login has been set up/);
  });
});

describe("forms report each wrong field", () => {
  it("firm: name required, pincode 6 digits", async () => {
    const e = await rejects(OPS.createFirm(db, { values: { form: { pincode: "12" } } }));
    expect(e.fields).toMatchObject({ "form.name": "Required", "form.pincode": expect.stringMatching(/6 digits/) });
  });
  it("duplicate firm name is explained, not a database error", async () => {
    await OPS.createFirm(db, { values: FIRM });
    const e = await rejects(OPS.createFirm(db, { values: { form: { name: "Secure Eye" } } }));
    expect(e.message).toBe("A firm with this name already exists.");
    expect(e.fields).toHaveProperty("form.name");
  });
  it("work order: completion before commencement, and no wage rate", async () => {
    const firm = await OPS.createFirm(db, { values: FIRM });
    const e = await rejects(OPS.createWorkOrder(db, {
      firmId: firm.id, values: { ...ORDER, form: { ...ORDER.form, end: "2026-01-01" }, rates: {} },
    }));
    expect(e.fields).toHaveProperty("form.end");
    expect(e.fields).toHaveProperty("rates.Unskilled");
  });
  it("work order: the firm comes from the top bar, not the form", async () => {
    const { firm, wo } = await setup();
    expect(wo.firmId).toBe(firm.id);
    expect(wo.status).toBe("pending");
  });
  it("same work order number twice in one firm is refused with a message", async () => {
    const { firm } = await setup();
    const e = await rejects(OPS.createWorkOrder(db, { firmId: firm.id, values: ORDER }));
    expect(e.message).toMatch(/already has a work order with this number/);
  });
});

describe("workmen: Aadhaar is typed when adding and can be corrected later", () => {
  it("new workman: Aadhaar is required and must be 12 digits", async () => {
    const { firm } = await setup();
    let e = await rejects(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("") }));
    expect(e.fields["details.aadhaar"]).toBe("Required");
    e = await rejects(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("1234") }));
    expect(e.fields["details.aadhaar"]).toMatch(/12 digits/);
  });
  it("new workman gets a WUIN; the Aadhaar typed is stored", async () => {
    const { firm } = await setup();
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    expect(w.wuin).toBe("WM00001");
    expect(w.aadhaar).toBe("123412341234");
    expect((await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("999988887777") })).wuin).toBe("WM00002");
  });
  it("editing can change the Aadhaar and the WUIN (CR-3: everything is editable)", async () => {
    const { firm } = await setup();
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.updateWorkman(db, { firmId: firm.id, workmanId: w.id, values: WORKMAN("555555555555", { name: "Ramesh K", wuin: "SE-0001" }) });
    const [after] = await db.select().from(workmen).where(eq(workmen.id, w.id));
    expect(after).toMatchObject({ aadhaar: "555555555555", name: "Ramesh K", wuin: "SE-0001" });
  });
  it("saving a workman with its own Aadhaar again is fine; taking another's is refused", async () => {
    const { firm } = await setup();
    const a = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("111111111111") });
    const b = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("222222222222") });
    await OPS.updateWorkman(db, { firmId: firm.id, workmanId: a.id, values: WORKMAN("111111111111", { name: "Same" }) });
    const e = await rejects(OPS.updateWorkman(db, { firmId: firm.id, workmanId: b.id, values: WORKMAN("111111111111") }));
    expect(e.fields["details.aadhaar"]).toMatch(/WM00001/);
  });
  it("blank WUIN on edit keeps the current one; a WUIN used by someone else is refused", async () => {
    const { firm } = await setup();
    const a = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("111111111111") });
    const b = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("222222222222") });
    expect((await OPS.updateWorkman(db, { firmId: firm.id, workmanId: b.id, values: WORKMAN("222222222222", { wuin: "" }) })).wuin).toBe("WM00002");
    const e = await rejects(OPS.updateWorkman(db, { firmId: firm.id, workmanId: b.id, values: WORKMAN("222222222222", { wuin: a.wuin }) }));
    expect(e.fields).toHaveProperty("details.wuin");
  });
  it("duplicate Aadhaar names the existing WUIN", async () => {
    const { firm } = await setup();
    await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    const e = await rejects(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() }));
    expect(e.fields["details.aadhaar"]).toMatch(/WM00001/);
  });
  it("bulk accommodation updates only the ticked workmen of this firm", async () => {
    const { firm } = await setup();
    const a = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("111111111111") });
    const b = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("222222222222") });
    expect(await OPS.setAccommodation(db, { firmId: firm.id, workmanIds: [a.id], accommodation: "Company Quarter" })).toEqual({ updated: 1 });
    const rows = await db.select().from(workmen);
    expect(rows.find((r) => r.id === a.id).accommodation).toBe("Company Quarter");
    expect(rows.find((r) => r.id === b.id).accommodation).toBe("Self");
    expect((await rejects(OPS.setAccommodation(db, { firmId: firm.id, workmanIds: [], accommodation: "Self" }))).message).toMatch(/Tick at least one/);
  });
});

describe("work order approval → engagement → wages", () => {
  it("cannot engage on a pending order; the message points to approval", async () => {
    const { firm, wo } = await setup();
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    const e = await rejects(OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] }));
    expect(e.message).toMatch(/waiting for approval/);
    expect(e.fix.to).toBe("wo_pending");
  });

  it("full flow: approve, engage, save wages, submit, approve wages", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    const saved = await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: w.id, daysWorked: "26", otMinutes: "0" }] });
    expect(saved).toMatchObject({ saved: 1, errors: {} });

    const snap = await firmSnapshot(db, firm.id);
    const sheet = snap.sheets.find((s) => s.id === saved.sheetId);
    expect(sheet.lines[0]).toMatchObject({ gross: 14456, net: 12613, wuin: "WM00001" });
    expect(snap.workOrders[0].workmenCount).toBe(1);
    expect(snap.workmen[0]).toMatchObject({ engagedIn: "GEMC-1", engagedWoId: wo.id, state: "active" });

    await OPS.submitWages(db, { firmId: firm.id, sheetId: saved.sheetId });
    expect((await rejects(OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: w.id, daysWorked: "20" }] }))).message).toMatch(/already submitted/);
    await OPS.approveWages(db, { firmId: firm.id, sheetId: saved.sheetId });
    expect((await firmSnapshot(db, firm.id)).sheets[0].status).toBe("approved");
  });

  it("a row error names the workman and keeps the other rows", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const a = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("111111111111") });
    const b = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("222222222222", { skill: "Skilled" }) });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: a.id, from: "2026-07-01" }, { workmanId: b.id, from: "2026-07-01" }] });
    const r = await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: a.id, daysWorked: "26" }, { workmanId: b.id, daysWorked: "26" }] });
    expect(r.saved).toBe(1);
    expect(r.errors[b.id]).toMatch(/no Per Day Wage set for "Skilled"/);
  });

  it("engaging on another order moves the workman; the old engagement ends the day before", async () => {
    const { firm, wo } = await setup();
    const wo2 = await OPS.createWorkOrder(db, { firmId: firm.id, values: { ...ORDER, form: { ...ORDER.form, woNo: "GEMC-2" } } });
    for (const o of [wo, wo2]) await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: o.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    const r = await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo2.id, rows: [{ workmanId: w.id, from: "2026-09-01" }] });
    expect(r).toMatchObject({ engaged: 1, moved: 1 });
    const rows = await db.select().from(engagements).where(eq(engagements.workmanId, w.id));
    expect(rows.map((e) => [e.workOrderId, e.engagedFrom, e.engagedTo])).toEqual([[wo.id, "2026-07-01", "2026-08-31"], [wo2.id, "2026-09-01", null]]);
    const again = await rejects(OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo2.id, rows: [{ workmanId: w.id, from: "2026-10-01" }] }));
    expect(again.fields[`row.${w.id}`]).toMatch(/already engaged on GEMC-2/);
  });

  it("date of exit ends the engagement and moves the workman out", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    await OPS.updateWorkman(db, { firmId: firm.id, workmanId: w.id, values: WORKMAN("123412341234", { exitDate: "2026-09-15" }) });
    const snap = await firmSnapshot(db, firm.id);
    expect(snap.workmen[0]).toMatchObject({ state: "moved", to: "2026-09-15" });
    expect(snap.engagements[0].to).toBe("2026-09-15");
  });

  it("completing an order ends its engagements: workmen become inactive", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    expect(await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "complete" })).toMatchObject({ status: "completed", ended: 1 });
    expect((await firmSnapshot(db, firm.id)).workmen[0].state).toBe("inactive");
  });

  it("approving an order without a wage rate points to its Config", async () => {
    const firm = await OPS.createFirm(db, { values: FIRM });
    const wo = await OPS.createWorkOrder(db, { firmId: firm.id, values: ORDER });
    await t.client.query(`DELETE FROM work_order_rates WHERE work_order_id = ${wo.id}`);
    const e = await rejects(OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" }));
    expect(e.fix).toMatchObject({ to: "wo_config", params: { wo: wo.id } });
  });

  it("changing Config recalculates draft months only", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    const aug = await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: w.id, daysWorked: "26" }] });
    await OPS.submitWages(db, { firmId: firm.id, sheetId: aug.sheetId });
    await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 9, rows: [{ workmanId: w.id, daysWorked: "26" }] });
    const r = await OPS.saveConfig(db, { firmId: firm.id, workOrderId: wo.id, values: { ...ORDER, rates: { Unskilled: { basicDaily: "600" } } } });
    expect(r.recalculated).toBe(1);
    const snap = await firmSnapshot(db, firm.id);
    expect(snap.sheets.find((s) => s.month === 9).lines[0].basic).toBe(600);
    expect(snap.sheets.find((s) => s.month === 8).lines[0].basic).toBe(556);
  });
});

describe("firm isolation", () => {
  it("one firm cannot open another firm's work order or workman", async () => {
    const { wo } = await setup();
    const other = await OPS.createFirm(db, { values: { form: { name: "Other" } } });
    expect((await rejects(OPS.getWorkOrder(db, { firmId: other.id, workOrderId: wo.id }))).message).toMatch(/work order of this firm/);
    const [any] = await db.select().from(firms);
    expect(any).toBeDefined();
  });
});

describe("dispatch register", () => {
  it("a bill is linked to a work order of the firm and checks received date", async () => {
    const { firm, wo } = await setup();
    const e = await rejects(OPS.saveBill(db, { firmId: firm.id, values: { details: { partyName: "NEC", billNo: "B1", billDate: "2026-09-01", taxable: "1000", received: "900" } } }));
    expect(e.fields).toHaveProperty("details.receivedDate");
    const b = await OPS.saveBill(db, { firmId: firm.id, values: { details: { wo: String(wo.id), partyName: "NEC", billNo: "B1", billDate: "2026-09-01", taxable: "1000" } } });
    expect(b).toMatchObject({ workOrderId: wo.id, gstPaymentStatus: "Pending" });
    expect((await firmSnapshot(db, firm.id)).bills[0]).toMatchObject({ woNo: "GEMC-1", billNo: "B1" });
  });
});

// ---------------- CR-3: field validation in every form ----------------
const bad = async (p) => (await rejects(p)).fields ?? {};

describe("field validation (same rules as on screen, lib/validate.js)", () => {
  it("workman: Aadhaar 12 digits only, mobile, bank account, IFSC, PAN, ESIC IP, UAN, names, nominee", async () => {
    const { firm } = await setup();
    const f = await bad(OPS.createWorkman(db, { firmId: firm.id, values: {
      details: { ...WORKMAN().details, aadhaar: "12341234123", mobile: "12345", bankAc: "12ab", ifsc: "SBIN1234567", pan: "ABCD1234", esic: "123", uan: "1", name: "R4mesh", relative: "Suresh!" },
      nominee: { aadhaar: "1234", dob: "2999-01-01" }, emergency: { phone: "999" },
    } }));
    expect(f["details.aadhaar"]).toMatch(/12 digits/);
    expect(f["details.mobile"]).toMatch(/10-digit mobile/);
    expect(f["details.bankAc"]).toMatch(/9 to 18 digits/);
    expect(f["details.ifsc"]).toMatch(/11 characters/);
    expect(f["details.pan"]).toMatch(/ABCDE1234F/);
    expect(f["details.esic"]).toMatch(/10 digits/);
    expect(f["details.uan"]).toBeDefined();
    expect(f["details.name"]).toMatch(/letters/);
    expect(f["details.relative"]).toMatch(/letters/);
    expect(f["nominee.aadhaar"]).toMatch(/12 digits/);
    expect(f["emergency.phone"]).toMatch(/10-digit mobile/);
  });
  it("workman: letters and spaces typed into number fields are dropped, not stored", async () => {
    const { firm } = await setup();
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("1234 5678 9012", { mobile: "98765 43210", ifsc: "sbin0001234" }) });
    expect(w).toMatchObject({ aadhaar: "123456789012", mobile: "9876543210", ifsc: "SBIN0001234" });
  });
  it("workman: date of birth in the past and at least 18 at joining (lib/rules.js minimumAge)", async () => {
    const { firm } = await setup();
    expect((await bad(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("1", { dob: "2030-01-01" }) })))["details.dob"]).toMatch(/past/);
    expect((await bad(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("123412341234", { dob: "2012-01-01" }) })))["details.doj"]).toMatch(/under 18/);
  });
  it("workman: a choice not in the list is refused", async () => {
    const { firm } = await setup();
    expect((await bad(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("123412341234", { gender: "X" }) })))["details.gender"]).toMatch(/options/);
  });
  it("firm: GSTIN, PAN, mobile, email, pincode, ESIC code, and lengths", async () => {
    const f = await bad(OPS.createFirm(db, { values: { form: {
      name: "X".repeat(201), gstin: "123", pan: "abc", mobile: "5555555555", email: "a@b", pincode: "012345", esic: "123", cuin: "C@1",
    } } }));
    expect(f["form.name"]).toMatch(/at most 200/);
    expect(f["form.gstin"]).toMatch(/15 characters/);
    expect(f["form.pan"]).toBeDefined();
    expect(f["form.mobile"]).toMatch(/starting with 6, 7, 8 or 9/);
    expect(f["form.email"]).toMatch(/email/);
    expect(f["form.pincode"]).toMatch(/not starting with 0/);
    expect(f["form.esic"]).toMatch(/17 digits/);
    expect(f["form.cuin"]).toMatch(/letters, numbers/);
  });
  it("work order: number format, district, contact, dates, Config numbers and per day wages", async () => {
    const firm = await OPS.createFirm(db, { values: FIRM });
    const f = await bad(OPS.createWorkOrder(db, { firmId: firm.id, values: {
      form: { ...ORDER.form, woNo: "WO#1", district: "123", peContact: "call me", start: "2026-02-30" },
      statutory: { ...ORDER.statutory, epfPercent: "120", hoursPerDay: "30", otMultiplier: "0.5" },
      rates: { Unskilled: { basicDaily: "556.555" }, Skilled: { basicDaily: "0" } },
    } }));
    expect(f["form.woNo"]).toMatch(/letters, numbers/);
    expect(f["form.district"]).toBeDefined();
    expect(f["form.peContact"]).toMatch(/phone number or an email/);
    expect(f["form.start"]).toMatch(/valid date/);
    expect(f["statutory.epfPercent"]).toMatch(/between 0 and 100/);
    expect(f["statutory.hoursPerDay"]).toMatch(/at most 24/);
    expect(f["statutory.otMultiplier"]).toMatch(/at least 1/);
    expect(f["rates.Unskilled"]).toMatch(/2 decimals/);
    expect(f["rates.Skilled"]).toMatch(/more than 0/);
  });
  it("bill: amounts with at most 2 decimals; received and approval dates not before the bill", async () => {
    const { firm } = await setup();
    const f = await bad(OPS.saveBill(db, { firmId: firm.id, values: { details: {
      partyName: "NEC", billNo: "B 1", billDate: "2026-09-10", taxable: "12.345", received: "100", receivedDate: "2026-09-01",
      approved: "Yes", approvalDate: "2026-09-01",
    } } }));
    expect(f["details.taxable"]).toMatch(/2 decimals/);
    expect(f["details.receivedDate"]).toMatch(/on or after the Bill Date/);
    expect(f["details.approvalDate"]).toMatch(/on or after the Bill Date/);
  });
  it("reset password: at least 10 characters", async () => {
    expect((await bad(OPS.resetPassword(db, { values: { form: { current: "x", new: "short", confirm: "short" } } })))["form.new"]).toMatch(/at least 10/);
  });
});

describe("rules can be relaxed (lib/rules.js)", () => {
  const swap = async (patch, fn) => {
    const before = { ...RULES };
    Object.assign(RULES, patch);
    try { return await fn(); } finally { Object.assign(RULES, before); }
  };
  it("checkFormats off: an unusual Aadhaar is accepted (length limits still apply)", async () => {
    const { firm } = await setup();
    const w = await swap({ checkFormats: false }, () => OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN("12345") }));
    expect(w.aadhaar).toBe("12345");
  });
  it("aadhaarUniquePerFirm off: two workmen may share an Aadhaar", async () => {
    const { firm } = await setup();
    await swap({ aadhaarUniquePerFirm: false }, async () => {
      await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
      await expect(OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() })).resolves.toBeDefined();
    });
  });
  it("lockedAfterCreate: a listed field keeps its saved value on edit", async () => {
    const { firm } = await setup();
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await swap({ lockedAfterCreate: { wm_edit: ["details.aadhaar"] } }, () =>
      OPS.updateWorkman(db, { firmId: firm.id, workmanId: w.id, values: WORKMAN("999999999999") }));
    const [after] = await db.select().from(workmen).where(eq(workmen.id, w.id));
    expect(after.aadhaar).toBe("123412341234");
  });
});

describe("CR-3: engagements and submitted wages can be corrected", () => {
  it("engagement dates can be edited; an end before the start is refused", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    const [e] = await db.select().from(engagements).where(eq(engagements.workmanId, w.id));
    expect((await OPS.editEngagement(db, { firmId: firm.id, engagementId: e.id, from: "2026-06-15", to: "" })).engagedFrom).toBe("2026-06-15");
    expect((await rejects(OPS.editEngagement(db, { firmId: firm.id, engagementId: e.id, from: "2026-06-15", to: "2026-06-01" }))).message).toMatch(/on or after Engaged From/);
  });
  it("a submitted month can be reopened, corrected and submitted again", async () => {
    const { firm, wo } = await setup();
    await OPS.setWorkOrderStatus(db, { firmId: firm.id, workOrderId: wo.id, move: "approve" });
    const w = await OPS.createWorkman(db, { firmId: firm.id, values: WORKMAN() });
    await OPS.engageWorkmen(db, { firmId: firm.id, workOrderId: wo.id, rows: [{ workmanId: w.id, from: "2026-07-01" }] });
    const r = await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: w.id, daysWorked: "26" }] });
    await OPS.submitWages(db, { firmId: firm.id, sheetId: r.sheetId });
    await OPS.reopenWages(db, { firmId: firm.id, sheetId: r.sheetId });
    const again = await OPS.saveWages(db, { firmId: firm.id, workOrderId: wo.id, year: 2026, month: 8, rows: [{ workmanId: w.id, daysWorked: "25" }] });
    expect(again.saved).toBe(1);
    expect((await firmSnapshot(db, firm.id)).sheets[0].lines[0].net).toBe(12128);
  });
});
