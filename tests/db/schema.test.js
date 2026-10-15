// Database rules, tested against a real PostgreSQL engine (PGlite, in memory).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { makeWorkOrder, makeWorkman, engage, makeSheet, recordAttendance } from "../helpers/factories";
import { workOrders, engagements, monthlySheets, attendanceEntries, dispatchRegister, firmSettings } from "@/db/schema";

let t;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.close(); });

const rejects = (p) => expect(p).rejects.toThrow();

describe("work orders", () => {
  it("default to pending approval", async () => {
    const wo = await makeWorkOrder(t.db, { status: undefined });
    expect(wo.status).toBe("pending");
  });
  it("need a unique work order number", async () => {
    await makeWorkOrder(t.db, { woNumber: "GEMC-DUP" });
    await rejects(makeWorkOrder(t.db, { woNumber: "GEMC-DUP" }));
  });
  it("cannot end before they start", async () => {
    await rejects(makeWorkOrder(t.db, { commencementDate: "2026-10-01", completionDate: "2026-09-01" }));
  });
  it("only accept the client's Nature of Work options", async () => {
    await rejects(makeWorkOrder(t.db, { natureOfWork: "Painting" }));
    expect((await makeWorkOrder(t.db, { natureOfWork: "Watch and Ward" })).natureOfWork).toBe("Watch and Ward");
  });
});

describe("workmen", () => {
  it("need a 12-digit Aadhaar", async () => {
    await rejects(makeWorkman(t.db, { aadhaar: "12345" }));
    await rejects(makeWorkman(t.db, { aadhaar: "12345678901A" }));
  });
  it("cannot share an Aadhaar or WUIN", async () => {
    const w = await makeWorkman(t.db);
    await rejects(makeWorkman(t.db, { aadhaar: w.aadhaar }));
    await rejects(makeWorkman(t.db, { wuin: w.wuin }));
  });
  it("cannot exit before joining", async () => {
    await rejects(makeWorkman(t.db, { dateOfJoining: "2026-07-01", dateOfExit: "2026-06-01" }));
  });
});

describe("engagements", () => {
  it("allow only one open engagement per workman", async () => {
    const [a, b] = [await makeWorkOrder(t.db), await makeWorkOrder(t.db)];
    const w = await makeWorkman(t.db);
    await engage(t.db, w.id, a.id);
    await rejects(engage(t.db, w.id, b.id));
  });
  it("allow a new engagement once the old one is closed", async () => {
    const [a, b] = [await makeWorkOrder(t.db), await makeWorkOrder(t.db)];
    const w = await makeWorkman(t.db);
    const first = await engage(t.db, w.id, a.id);
    await t.db.update(engagements).set({ engagedTo: "2026-08-31" }).where(eq(engagements.id, first.id));
    const second = await engage(t.db, w.id, b.id, { engagedFrom: "2026-09-01" });
    expect(second.workOrderId).toBe(b.id);
  });
  it("block deleting a work order that has workmen engaged", async () => {
    const wo = await makeWorkOrder(t.db);
    await engage(t.db, (await makeWorkman(t.db)).id, wo.id);
    await rejects(t.db.delete(workOrders).where(eq(workOrders.id, wo.id)));
  });
});

describe("monthly sheets and attendance", () => {
  it("allow one sheet per work order per month", async () => {
    const wo = await makeWorkOrder(t.db);
    await makeSheet(t.db, wo.id);
    await rejects(makeSheet(t.db, wo.id));
    await rejects(makeSheet(t.db, wo.id, { month: 13 }));
  });
  it("keep wages in draft until attendance is submitted", async () => {
    const wo = await makeWorkOrder(t.db);
    await rejects(makeSheet(t.db, wo.id, { wageStatus: "submitted" }));
  });
  it("accept 0–31 days and OT minutes in 15-minute steps", async () => {
    const sheet = await makeSheet(t.db, (await makeWorkOrder(t.db)).id);
    const w = await makeWorkman(t.db);
    await rejects(recordAttendance(t.db, sheet.id, w.id, { daysWorked: "32" }));
    await rejects(recordAttendance(t.db, sheet.id, w.id, { otMinutes: 20 }));
    const ok = await recordAttendance(t.db, sheet.id, w.id, { daysWorked: "25.5", otHours: 2, otMinutes: 45 });
    expect(ok.daysWorked).toBe("25.5");
    await rejects(recordAttendance(t.db, sheet.id, w.id)); // one row per workman per sheet
  });
  it("delete attendance with its sheet", async () => {
    const sheet = await makeSheet(t.db, (await makeWorkOrder(t.db)).id);
    await recordAttendance(t.db, sheet.id, (await makeWorkman(t.db)).id);
    await t.db.delete(monthlySheets).where(eq(monthlySheets.id, sheet.id));
    expect(await t.db.select().from(attendanceEntries).where(eq(attendanceEntries.sheetId, sheet.id))).toHaveLength(0);
  });
});

describe("dispatch register", () => {
  const bill = (over = {}) => ({ partyNameContract: "NEC / GEMC-1", billNumber: `B-${Math.random()}`, billDate: "2026-09-30", taxableAmount: "100000", ...over });
  it("stores a bill with payment statuses defaulting to Pending", async () => {
    const [row] = await t.db.insert(dispatchRegister).values(bill()).returning();
    expect([row.gstPaymentStatus, row.epfPaymentStatus, row.esicPaymentStatus]).toEqual(["Pending", "Pending", "Pending"]);
  });
  it("needs a unique bill number and a date when money is received", async () => {
    await t.db.insert(dispatchRegister).values(bill({ billNumber: "B-1" }));
    await rejects(t.db.insert(dispatchRegister).values(bill({ billNumber: "B-1" })));
    await rejects(t.db.insert(dispatchRegister).values(bill({ receivedAmount: "5000" })));
  });
});

describe("firm settings", () => {
  it("is a single row", async () => {
    await t.db.insert(firmSettings).values({ id: 1, cuin: "10011515" });
    await rejects(t.db.insert(firmSettings).values({ id: 2 }));
  });
});
