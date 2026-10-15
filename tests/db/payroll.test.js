// Attendance → wages, end to end through the database.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { makeWorkOrder, makeWorkman, engage, makeSheet, recordAttendance, seedRates } from "../helpers/factories";
import { calculateSheetWages, submitAttendance } from "@/lib/payroll";
import { wageLines, wageRates, monthlySheets } from "@/db/schema";

let t, wo, sheet, worker;
beforeEach(async () => {
  t = await createTestDb();
  await seedRates(t.db);
  wo = await makeWorkOrder(t.db);
  worker = await makeWorkman(t.db);
  await engage(t.db, worker.id, wo.id);
  sheet = await makeSheet(t.db, wo.id);
  await recordAttendance(t.db, sheet.id, worker.id, { daysWorked: "26" });
});
afterEach(async () => { await t.close(); });

describe("calculateSheetWages", () => {
  it("refuses while attendance is a draft", async () => {
    await expect(calculateSheetWages(t.db, sheet.id)).rejects.toThrow(/submit attendance/);
  });

  it("calculates wages from days worked and the rate in force", async () => {
    await submitAttendance(t.db, sheet.id);
    const [line] = await calculateSheetWages(t.db, sheet.id);
    expect(line).toMatchObject({ daysWorked: "26.0", grossEarnings: "14456.00", epfDeduction: "1735.00", esiDeduction: "108.00", netEarnings: "12613.00" });
  });

  it("keeps old months unchanged when a new rate is added later", async () => {
    await submitAttendance(t.db, sheet.id);
    await calculateSheetWages(t.db, sheet.id);
    await t.db.insert(wageRates).values({ skillCategory: "Unskilled", basicDaily: "600", effectiveFrom: "2026-10-01" });
    const [again] = await calculateSheetWages(t.db, sheet.id); // August sheet still uses the April rate
    expect(again.basicRate).toBe("556.00");
  });

  it("keeps typed extras when recalculating", async () => {
    await submitAttendance(t.db, sheet.id);
    const [line] = await calculateSheetWages(t.db, sheet.id);
    await t.db.update(wageLines).set({ bonus: "500" }).where(eq(wageLines.id, line.id));
    const [again] = await calculateSheetWages(t.db, sheet.id);
    expect(again.bonus).toBe("500.00");
    expect(again.grossEarnings).toBe("14956.00");
  });

  it("refuses once wages are submitted", async () => {
    await submitAttendance(t.db, sheet.id);
    await calculateSheetWages(t.db, sheet.id);
    await t.db.update(monthlySheets).set({ wageStatus: "submitted" }).where(eq(monthlySheets.id, sheet.id));
    await expect(calculateSheetWages(t.db, sheet.id)).rejects.toThrow(/already submitted/);
  });

  it("explains a missing rate for a skill category", async () => {
    const skilled = await makeWorkman(t.db, { skillCategory: "Skilled" });
    await recordAttendance(t.db, sheet.id, skilled.id);
    await submitAttendance(t.db, sheet.id);
    await expect(calculateSheetWages(t.db, sheet.id)).rejects.toThrow(/no wage rate for "Skilled"/);
  });

  it("database rejects a wage line whose net does not add up", async () => {
    await submitAttendance(t.db, sheet.id);
    const [line] = await calculateSheetWages(t.db, sheet.id);
    await expect(t.db.update(wageLines).set({ netEarnings: "1" }).where(eq(wageLines.id, line.id))).rejects.toThrow();
  });
});
