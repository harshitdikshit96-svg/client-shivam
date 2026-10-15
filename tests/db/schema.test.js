// Database rules, tested against a real PostgreSQL engine (PGlite, in memory).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { makeFirm, makeWorkOrder, makeWorkman, engage, makeSheet, configure } from "../helpers/factories";
import { firms, workOrders, workOrderConfig, workOrderRates, engagements, monthlySheets, wageLines, dispatchRegister } from "@/db/schema";

let t, firm;
beforeAll(async () => { t = await createTestDb(); firm = await makeFirm(t.db); });
afterAll(async () => { await t.close(); });

const rejects = (p) => expect(p).rejects.toThrow();

describe("firms", () => {
  it("need a unique name and a 6-digit pincode", async () => {
    await makeFirm(t.db, { name: "Secure Eye" });
    await rejects(makeFirm(t.db, { name: "Secure Eye" }));
    await rejects(makeFirm(t.db, { pincode: "2260" }));
  });
  it("cannot be deleted while they have work orders", async () => {
    const f = await makeFirm(t.db);
    await makeWorkOrder(t.db, f.id);
    await rejects(t.db.delete(firms).where(eq(firms.id, f.id)));
  });
});

describe("work orders", () => {
  it("default to pending approval", async () => {
    expect((await makeWorkOrder(t.db, firm.id, { status: undefined })).status).toBe("pending");
  });
  it("need a work order number unique within the firm (another firm may reuse it)", async () => {
    await makeWorkOrder(t.db, firm.id, { woNumber: "GEMC-DUP" });
    await rejects(makeWorkOrder(t.db, firm.id, { woNumber: "GEMC-DUP" }));
    const other = await makeFirm(t.db);
    expect((await makeWorkOrder(t.db, other.id, { woNumber: "GEMC-DUP" })).firmId).toBe(other.id);
  });
  it("cannot end before they start", async () => {
    await rejects(makeWorkOrder(t.db, firm.id, { commencementDate: "2026-10-01", completionDate: "2026-09-01" }));
  });
  it("only accept the client's Nature of Work options", async () => {
    await rejects(makeWorkOrder(t.db, firm.id, { natureOfWork: "Painting" }));
  });
});

describe("work order Config", () => {
  it("defaults to EPF 12%, ESI 0.75% up to ₹21,000, OT ×2, 8-hour day", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await configure(t.db, wo.id);
    const [cfg] = await t.db.select().from(workOrderConfig).where(eq(workOrderConfig.workOrderId, wo.id));
    expect(cfg).toMatchObject({ epfPercent: "12.00", esiPercent: "0.75", esiGrossCeiling: "21000.00", otMultiplier: "2.00", hoursPerDay: 8 });
  });
  it("holds one Per Day Wage per skill category", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await configure(t.db, wo.id, { rates: { Unskilled: { basicDaily: "556" }, Skilled: { basicDaily: "700", vdaDaily: "50" } } });
    await rejects(t.db.insert(workOrderRates).values({ workOrderId: wo.id, skillCategory: "Unskilled", basicDaily: "600" }));
    await rejects(t.db.insert(workOrderRates).values({ workOrderId: wo.id, skillCategory: "Semi Skilled", basicDaily: "0" }));
  });
  it("rejects impossible settings", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await rejects(t.db.insert(workOrderConfig).values({ workOrderId: wo.id, epfPercent: "120" }));
    await rejects(t.db.insert(workOrderConfig).values({ workOrderId: wo.id, hoursPerDay: 0 }));
    await rejects(t.db.insert(workOrderConfig).values({ workOrderId: wo.id, deadlineDay: 40 }));
  });
  it("is deleted with its work order", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await configure(t.db, wo.id);
    await t.db.delete(workOrders).where(eq(workOrders.id, wo.id));
    expect(await t.db.select().from(workOrderRates).where(eq(workOrderRates.workOrderId, wo.id))).toHaveLength(0);
  });
});

describe("workmen", () => {
  it("need a 12-digit Aadhaar", async () => {
    await rejects(makeWorkman(t.db, firm.id, { aadhaar: "12345" }));
  });
  it("cannot repeat an Aadhaar or WUIN within a firm", async () => {
    const w = await makeWorkman(t.db, firm.id);
    await rejects(makeWorkman(t.db, firm.id, { aadhaar: w.aadhaar }));
    await rejects(makeWorkman(t.db, firm.id, { wuin: w.wuin }));
  });
  it("cannot exit before joining", async () => {
    await rejects(makeWorkman(t.db, firm.id, { dateOfJoining: "2026-07-01", dateOfExit: "2026-06-01" }));
  });
});

describe("engagements", () => {
  it("allow only one open engagement per workman", async () => {
    const [a, b] = [await makeWorkOrder(t.db, firm.id), await makeWorkOrder(t.db, firm.id)];
    const w = await makeWorkman(t.db, firm.id);
    await engage(t.db, w, a);
    await rejects(engage(t.db, w, b));
  });
  it("allow a new engagement once the old one is closed", async () => {
    const [a, b] = [await makeWorkOrder(t.db, firm.id), await makeWorkOrder(t.db, firm.id)];
    const w = await makeWorkman(t.db, firm.id);
    const first = await engage(t.db, w, a);
    await t.db.update(engagements).set({ engagedTo: "2026-08-31" }).where(eq(engagements.id, first.id));
    expect((await engage(t.db, w, b, { engagedFrom: "2026-09-01" })).workOrderId).toBe(b.id);
  });
  it("cannot tie a workman to another firm's work order", async () => {
    const other = await makeFirm(t.db);
    const theirOrder = await makeWorkOrder(t.db, other.id);
    const ourWorker = await makeWorkman(t.db, firm.id);
    await rejects(t.db.insert(engagements).values({ firmId: other.id, workmanId: ourWorker.id, workOrderId: theirOrder.id, engagedFrom: "2026-07-01" }));
    await rejects(t.db.insert(engagements).values({ firmId: firm.id, workmanId: ourWorker.id, workOrderId: theirOrder.id, engagedFrom: "2026-07-01" }));
  });
  it("block deleting a work order that has workmen engaged", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await engage(t.db, await makeWorkman(t.db, firm.id), wo);
    await rejects(t.db.delete(workOrders).where(eq(workOrders.id, wo.id)));
  });
});

describe("monthly sheets and wage lines", () => {
  it("allow one sheet per work order per month", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    await makeSheet(t.db, wo.id);
    await rejects(makeSheet(t.db, wo.id));
    await rejects(makeSheet(t.db, wo.id, { month: 13 }));
  });
  it("reject days outside 0–31 and OT minutes not in 15-minute steps", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    const sheet = await makeSheet(t.db, wo.id);
    const w = await makeWorkman(t.db, firm.id);
    const base = { sheetId: sheet.id, workmanId: w.id, skillCategory: "Unskilled", basicRate: "556", vdaRate: "0", epfPercent: "12", esiPercent: "0.75", otMultiplier: "2", basicVdaEarned: "0", grossEarnings: "0", epfDeduction: "0", esiDeduction: "0", totalDeduction: "0", netEarnings: "0" };
    await rejects(t.db.insert(wageLines).values({ ...base, daysWorked: "32" }));
    await rejects(t.db.insert(wageLines).values({ ...base, daysWorked: "10", otMinutes: 20 }));
    await rejects(t.db.insert(wageLines).values({ ...base, daysWorked: "10", netEarnings: "5" }));
  });
  it("delete wage lines with their sheet", async () => {
    const wo = await makeWorkOrder(t.db, firm.id);
    const sheet = await makeSheet(t.db, wo.id);
    await t.db.delete(monthlySheets).where(eq(monthlySheets.id, sheet.id));
    expect(await t.db.select().from(wageLines).where(eq(wageLines.sheetId, sheet.id))).toHaveLength(0);
  });
});

describe("dispatch register", () => {
  const bill = (over = {}) => ({ firmId: firm.id, partyNameContract: "NEC / GEMC-1", billNumber: `B-${Math.random()}`, billDate: "2026-09-30", taxableAmount: "100000", ...over });
  it("stores a bill with payment statuses defaulting to Pending", async () => {
    const [row] = await t.db.insert(dispatchRegister).values(bill()).returning();
    expect([row.gstPaymentStatus, row.epfPaymentStatus, row.esicPaymentStatus]).toEqual(["Pending", "Pending", "Pending"]);
  });
  it("needs a bill number unique within the firm and a date when money is received", async () => {
    await t.db.insert(dispatchRegister).values(bill({ billNumber: "B-1" }));
    await rejects(t.db.insert(dispatchRegister).values(bill({ billNumber: "B-1" })));
    await rejects(t.db.insert(dispatchRegister).values(bill({ receivedAmount: "5000" })));
  });
});
