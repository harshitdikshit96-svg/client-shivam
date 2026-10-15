// Payroll service: the database side of lib/wages.js.
// On the Wage Entry screen the user types days worked (and OT / extras) for a workman; saveWageLine
// calculates everything else from the work order's Config and stores a snapshot of the values used.
import { and, eq, lte, gte, isNull, or } from "drizzle-orm";
import { monthlySheets, workOrders, workOrderConfig, workOrderRates, workmen, engagements, wageLines } from "@/db/schema";
import { computeWageLine } from "./wages";

export class PayrollError extends Error {}

const EXTRA_KEYS = ["ugAllowance", "bonus", "edlis", "pli", "otherEarnings", "otherDeduction", "damageRecovery"];
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const firstDay = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;

/** The work order's Config as plain numbers, plus its per-skill rates. */
export async function loadConfig(db, workOrderId) {
  const [cfg] = await db.select().from(workOrderConfig).where(eq(workOrderConfig.workOrderId, workOrderId));
  if (!cfg) throw new PayrollError("this work order has no Config yet — set per day wages and deductions first");
  const rates = await db.select().from(workOrderRates).where(eq(workOrderRates.workOrderId, workOrderId));
  return {
    statutory: {
      epfPercent: Number(cfg.epfPercent),
      epfWageCeiling: cfg.epfWageCeiling == null ? null : Number(cfg.epfWageCeiling),
      esiPercent: Number(cfg.esiPercent),
      esiGrossCeiling: cfg.esiGrossCeiling == null ? null : Number(cfg.esiGrossCeiling),
    },
    otMultiplier: Number(cfg.otMultiplier),
    hoursPerDay: cfg.hoursPerDay,
    rates: Object.fromEntries(rates.map((r) => [r.skillCategory, { basicDaily: Number(r.basicDaily), vdaDaily: Number(r.vdaDaily) }])),
  };
}

async function draftSheet(db, sheetId) {
  const [sheet] = await db.select().from(monthlySheets).where(eq(monthlySheets.id, sheetId));
  if (!sheet) throw new PayrollError(`sheet ${sheetId} not found`);
  if (sheet.status !== "draft") throw new PayrollError("wages for this month are already submitted");
  return sheet;
}

function calculate(config, person, input) {
  const rate = config.rates[person.skillCategory];
  if (!rate) throw new PayrollError(`no Per Day Wage set for "${person.skillCategory}" in this work order's Config`);
  const extras = Object.fromEntries(EXTRA_KEYS.map((k) => [k, input[k] ?? 0]));
  const line = computeWageLine({
    daysWorked: input.daysWorked,
    otHours: input.otHours ?? 0,
    otMinutes: input.otMinutes ?? 0,
    rate: { ...rate, otMultiplier: config.otMultiplier, hoursPerDay: config.hoursPerDay },
    statutory: config.statutory,
    extras,
  });
  return line;
}

const asRow = (sheetId, person, input, config, line) => ({
  sheetId,
  workmanId: person.id,
  daysWorked: String(input.daysWorked),
  otHours: Number(input.otHours ?? 0),
  otMinutes: Number(input.otMinutes ?? 0),
  ...Object.fromEntries(EXTRA_KEYS.map((k) => [k, String(line[k])])),
  remarks: input.remarks ?? null,
  skillCategory: person.skillCategory,
  basicRate: String(line.basicRate),
  vdaRate: String(line.vdaRate),
  epfPercent: String(config.statutory.epfPercent),
  esiPercent: String(config.statutory.esiPercent),
  otMultiplier: String(config.otMultiplier),
  basicVdaEarned: String(line.basicVdaEarned),
  otAmount: String(line.otAmount),
  grossEarnings: String(line.grossEarnings),
  epfDeduction: String(line.epfDeduction),
  esiDeduction: String(line.esiDeduction),
  totalDeduction: String(line.totalDeduction),
  netEarnings: String(line.netEarnings),
  calculatedAt: new Date(),
});

/**
 * Save what was typed for one workman on the Wage Entry screen and return the calculated line.
 * input: { daysWorked, otHours?, otMinutes?, ugAllowance?, bonus?, edlis?, pli?, otherEarnings?, otherDeduction?, damageRecovery?, remarks? }
 */
export async function saveWageLine(db, sheetId, workmanId, input) {
  const sheet = await draftSheet(db, sheetId);
  const [person] = await db.select().from(workmen).where(eq(workmen.id, workmanId));
  if (!person) throw new PayrollError(`workman ${workmanId} not found`);

  // the workman must be engaged on this work order at some point in the month
  const [engaged] = await db.select({ id: engagements.id }).from(engagements).where(and(
    eq(engagements.workmanId, workmanId),
    eq(engagements.workOrderId, sheet.workOrderId),
    lte(engagements.engagedFrom, lastDay(sheet.year, sheet.month)),
    or(isNull(engagements.engagedTo), gte(engagements.engagedTo, firstDay(sheet.year, sheet.month))),
  ));
  if (!engaged) throw new PayrollError(`${person.name} is not engaged on this work order in ${sheet.month}/${sheet.year}`);

  const config = await loadConfig(db, sheet.workOrderId);
  const line = calculate(config, person, input);
  const row = asRow(sheetId, person, input, config, line);
  const { sheetId: _s, workmanId: _w, ...update } = row;
  const [saved] = await db.insert(wageLines).values(row)
    .onConflictDoUpdate({ target: [wageLines.sheetId, wageLines.workmanId], set: update })
    .returning();
  return saved;
}

/** Re-run every line of a draft month with the current Config (after Config was changed). */
export async function recalculateSheet(db, sheetId) {
  const sheet = await draftSheet(db, sheetId);
  const config = await loadConfig(db, sheet.workOrderId);
  const lines = await db.select().from(wageLines).where(eq(wageLines.sheetId, sheetId));
  const out = [];
  for (const l of lines) {
    const [person] = await db.select().from(workmen).where(eq(workmen.id, l.workmanId));
    const input = { daysWorked: l.daysWorked, otHours: l.otHours, otMinutes: l.otMinutes, remarks: l.remarks, ...Object.fromEntries(EXTRA_KEYS.map((k) => [k, l[k]])) };
    const row = asRow(sheetId, person, input, config, calculate(config, person, input));
    const { sheetId: _s, workmanId: _w, ...update } = row;
    const [saved] = await db.update(wageLines).set(update).where(eq(wageLines.id, l.id)).returning();
    out.push(saved);
  }
  return out;
}

/** Lock a month (draft → submitted). Submitted months never change, even if Config changes later. */
export async function submitSheet(db, sheetId) {
  const [row] = await db.update(monthlySheets)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(and(eq(monthlySheets.id, sheetId), eq(monthlySheets.status, "draft")))
    .returning();
  if (!row) throw new PayrollError("this month is not a draft (already submitted?)");
  return row;
}

/** Firm guard used by every screen: a work order is only visible inside its own firm. */
export async function workOrderInFirm(db, firmId, workOrderId) {
  const [wo] = await db.select().from(workOrders).where(and(eq(workOrders.id, workOrderId), eq(workOrders.firmId, firmId)));
  return wo ?? null;
}
