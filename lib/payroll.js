// Payroll service: turns a month's attendance into wage lines (database side of lib/wages.js).
import { and, eq, inArray } from "drizzle-orm";
import {
  monthlySheets, attendanceEntries, workmen, wageRates, statutoryRates, wageLines,
} from "@/db/schema";
import { computeWageLine, rateInForce, periodStart } from "./wages";

export class PayrollError extends Error {}

/**
 * Recalculate wage lines for one monthly sheet from its attendance.
 * Extras already typed on existing wage lines (bonus, PLI, deductions…) are kept.
 * Refuses while attendance is still a draft, or once wages are submitted/approved (they are frozen).
 */
export async function calculateSheetWages(db, sheetId) {
  const [sheet] = await db.select().from(monthlySheets).where(eq(monthlySheets.id, sheetId));
  if (!sheet) throw new PayrollError(`sheet ${sheetId} not found`);
  if (sheet.attendanceStatus === "draft") throw new PayrollError("submit attendance before calculating wages");
  if (sheet.wageStatus !== "draft") throw new PayrollError("wages already submitted for this month");

  const onDate = periodStart(sheet.year, sheet.month);
  const attendance = await db.select().from(attendanceEntries).where(eq(attendanceEntries.sheetId, sheetId));
  if (!attendance.length) return [];

  const people = await db.select().from(workmen).where(inArray(workmen.id, attendance.map((a) => a.workmanId)));
  const byId = new Map(people.map((p) => [p.id, p]));
  const rates = await db.select().from(wageRates);
  const statutory = rateInForce(await db.select().from(statutoryRates), onDate);
  if (!statutory) throw new PayrollError(`no statutory rates in force on ${onDate}`);

  const existing = await db.select().from(wageLines).where(eq(wageLines.sheetId, sheetId));
  const extrasFor = new Map(existing.map((l) => [l.workmanId, l]));

  const rows = attendance.map((a) => {
    const person = byId.get(a.workmanId);
    const rate = rateInForce(rates.filter((r) => r.skillCategory === person.skillCategory), onDate);
    if (!rate) throw new PayrollError(`no wage rate for "${person.skillCategory}" in force on ${onDate}`);
    const prev = extrasFor.get(a.workmanId) ?? {};
    const line = computeWageLine({
      daysWorked: a.daysWorked,
      otHours: a.otHours,
      otMinutes: a.otMinutes,
      rate,
      statutory,
      extras: {
        ugAllowance: prev.ugAllowance, bonus: prev.bonus, edlis: prev.edlis, pli: prev.pli,
        otherEarnings: prev.otherEarnings, otherDeduction: prev.otherDeduction, damageRecovery: prev.damageRecovery,
      },
    });
    return {
      sheetId, workmanId: a.workmanId, wageRateId: rate.id, statutoryRateId: statutory.id,
      ...Object.fromEntries(Object.entries(line).map(([k, v]) => [k, String(v)])),
      calculatedAt: new Date(),
    };
  });

  await db.transaction(async (tx) => {
    await tx.delete(wageLines).where(eq(wageLines.sheetId, sheetId));
    await tx.insert(wageLines).values(rows);
  });
  return db.select().from(wageLines).where(eq(wageLines.sheetId, sheetId));
}

/** Lock attendance for a sheet (draft → submitted). */
export async function submitAttendance(db, sheetId) {
  const [row] = await db.update(monthlySheets)
    .set({ attendanceStatus: "submitted", attendanceSubmittedAt: new Date() })
    .where(and(eq(monthlySheets.id, sheetId), eq(monthlySheets.attendanceStatus, "draft")))
    .returning();
  if (!row) throw new PayrollError("attendance is not a draft (already submitted?)");
  return row;
}
