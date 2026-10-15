// Wage Entry: type days worked → wages and deductions calculated from the work order's Config.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { makeFirm, makeWorkOrder, makeWorkman, engage, makeSheet, configure } from "../helpers/factories";
import { saveWageLine, recalculateSheet, submitSheet } from "@/lib/payroll";
import { workOrderRates, workOrderConfig } from "@/db/schema";
import { and } from "drizzle-orm";

let t, firm, wo, sheet, worker;
beforeEach(async () => {
  t = await createTestDb();
  firm = await makeFirm(t.db);
  wo = await makeWorkOrder(t.db, firm.id);
  await configure(t.db, wo.id);                       // Unskilled ₹556/day, EPF 12%, ESI 0.75%
  worker = await makeWorkman(t.db, firm.id);
  await engage(t.db, worker, wo);
  sheet = await makeSheet(t.db, wo.id);
});
afterEach(async () => { await t.close(); });

describe("saveWageLine", () => {
  it("calculates everything from the days typed (matches the client's August CLIP sheet)", async () => {
    const line = await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26 });
    expect(line).toMatchObject({
      daysWorked: "26.0", basicRate: "556.00", basicVdaEarned: "14456.00", grossEarnings: "14456.00",
      epfDeduction: "1735.00", esiDeduction: "108.00", totalDeduction: "1843.00", netEarnings: "12613.00",
    });
  });

  it("updates the same row when days are corrected", async () => {
    await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26 });
    const line = await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 21 });
    expect(line.netEarnings).toBe("10187.00");
  });

  it("adds overtime and typed extras", async () => {
    const line = await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26, otHours: 2, otMinutes: 30, bonus: 500, damageRecovery: 100 });
    expect(line.otAmount).toBe("347.50");            // 556 / 8 × 2 × 2.5 h
    expect(line.grossEarnings).toBe("15303.50");
    expect(line.damageRecovery).toBe("100.00");
  });

  it("uses this work order's own Config", async () => {
    await t.db.update(workOrderConfig).set({ epfPercent: "10", esiGrossCeiling: null }).where(eq(workOrderConfig.workOrderId, wo.id));
    const line = await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26 });
    expect(line.epfDeduction).toBe("1446.00");       // 10% of 14,456
    expect(line.epfPercent).toBe("10.00");
  });

  it("refuses a workman not engaged on this work order that month", async () => {
    const stranger = await makeWorkman(t.db, firm.id);
    await expect(saveWageLine(t.db, sheet.id, stranger.id, { daysWorked: 10 })).rejects.toThrow(/not engaged/);
  });

  it("explains a missing Per Day Wage for the workman's skill", async () => {
    const skilled = await makeWorkman(t.db, firm.id, { skillCategory: "Skilled" });
    await engage(t.db, skilled, wo);
    await expect(saveWageLine(t.db, sheet.id, skilled.id, { daysWorked: 10 })).rejects.toThrow(/no Per Day Wage set for "Skilled"/);
  });

  it("refuses a work order with no Config", async () => {
    const bare = await makeWorkOrder(t.db, firm.id);
    const w = await makeWorkman(t.db, firm.id);
    await engage(t.db, w, bare);
    const s = await makeSheet(t.db, bare.id);
    await expect(saveWageLine(t.db, s.id, w.id, { daysWorked: 10 })).rejects.toThrow(/no Config/);
  });

  it("rejects invalid days", async () => {
    await expect(saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 40 })).rejects.toThrow(/daysWorked/);
  });
});

describe("Config changes and submission", () => {
  it("recalculates a draft month when the Per Day Wage changes", async () => {
    await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26, bonus: 500 });
    await t.db.update(workOrderRates).set({ basicDaily: "600" })
      .where(and(eq(workOrderRates.workOrderId, wo.id), eq(workOrderRates.skillCategory, "Unskilled")));
    const [line] = await recalculateSheet(t.db, sheet.id);
    expect(line.basicVdaEarned).toBe("15600.00");
    expect(line.bonus).toBe("500.00");               // typed extras are kept
  });

  it("locks a month once submitted", async () => {
    await saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 26 });
    await submitSheet(t.db, sheet.id);
    await expect(saveWageLine(t.db, sheet.id, worker.id, { daysWorked: 20 })).rejects.toThrow(/already submitted/);
    await expect(recalculateSheet(t.db, sheet.id)).rejects.toThrow(/already submitted/);
    await expect(submitSheet(t.db, sheet.id)).rejects.toThrow(/not a draft/);
  });
});
