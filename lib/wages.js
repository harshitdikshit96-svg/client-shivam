// Wage engine: pure functions, no database. All arithmetic in paise (integers) to avoid float errors.
// Rounding: each statutory deduction is rounded to the nearest rupee, matching the CLIP wage sheet
// (26 days × ₹556 = ₹14,456 → EPF ₹1,735, ESI ₹108, net ₹12,613).

const toPaise = (v) => Math.round(Number(v ?? 0) * 100);
const toRupees = (p) => p / 100;
const roundToRupee = (p) => Math.round(p / 100) * 100;
const pct = (paise, percent) => (paise * Number(percent)) / 100;

export const OT_MINUTE_STEPS = [0, 15, 30, 45];

/**
 * @param {object} input
 * @param {number} input.daysWorked         from attendance (0–31, may be .5)
 * @param {number} [input.otHours]
 * @param {number} [input.otMinutes]        0 | 15 | 30 | 45
 * @param {object} input.rate               { basicDaily, vdaDaily, otMultiplier = 2, hoursPerDay = 8 }
 * @param {object} input.statutory          { epfPercent = 12, epfWageCeiling = null, esiPercent = 0.75, esiGrossCeiling = 21000 }
 * @param {object} [input.extras]           { ugAllowance, bonus, edlis, pli, otherEarnings, otherDeduction, damageRecovery }
 * @returns {object} every wage-grid column, in rupees
 */
export function computeWageLine({ daysWorked, otHours = 0, otMinutes = 0, rate, statutory = {}, extras = {} }) {
  const days = Number(daysWorked);
  if (!Number.isFinite(days) || days < 0 || days > 31) throw new RangeError(`daysWorked must be 0–31, got ${daysWorked}`);
  if (!OT_MINUTE_STEPS.includes(Number(otMinutes))) throw new RangeError(`otMinutes must be one of ${OT_MINUTE_STEPS.join(", ")}`);
  if (Number(otHours) < 0) throw new RangeError("otHours must be >= 0");
  if (!rate || Number(rate.basicDaily) <= 0) throw new RangeError("a wage rate with basicDaily > 0 is required");

  for (const [k, v] of Object.entries(extras)) {
    if (Number(v ?? 0) < 0) throw new RangeError(`${k} cannot be negative`);
  }

  const basic = toPaise(rate.basicDaily);
  const vda = toPaise(rate.vdaDaily);
  const hoursPerDay = Number(rate.hoursPerDay ?? 8);
  const otMultiplier = Number(rate.otMultiplier ?? 2);

  const basicVdaEarned = Math.round((basic + vda) * days);
  const otHoursTotal = Number(otHours) + Number(otMinutes) / 60;
  const otAmount = Math.round(((basic + vda) / hoursPerDay) * otMultiplier * otHoursTotal);

  const e = {
    ugAllowance: toPaise(extras.ugAllowance),
    bonus: toPaise(extras.bonus),
    edlis: toPaise(extras.edlis),
    pli: toPaise(extras.pli),
    otherEarnings: toPaise(extras.otherEarnings),
    otherDeduction: toPaise(extras.otherDeduction),
    damageRecovery: toPaise(extras.damageRecovery),
  };

  const gross = basicVdaEarned + otAmount + e.ugAllowance + e.bonus + e.edlis + e.pli + e.otherEarnings;

  const epfPercent = statutory.epfPercent ?? 12;
  const epfCeiling = statutory.epfWageCeiling == null ? null : toPaise(statutory.epfWageCeiling);
  const epfBase = epfCeiling == null ? basicVdaEarned : Math.min(basicVdaEarned, epfCeiling);
  const epf = roundToRupee(pct(epfBase, epfPercent));

  const esiPercent = statutory.esiPercent ?? 0.75;
  const esiCeiling = statutory.esiGrossCeiling === undefined ? toPaise(21000) : statutory.esiGrossCeiling == null ? null : toPaise(statutory.esiGrossCeiling);
  const esi = esiCeiling == null || gross <= esiCeiling ? roundToRupee(pct(gross, esiPercent)) : 0;

  const totalDeduction = epf + esi + e.otherDeduction + e.damageRecovery;
  const net = gross - totalDeduction;

  return {
    daysWorked: days,
    basicRate: toRupees(basic),
    vdaRate: toRupees(vda),
    basicVdaEarned: toRupees(basicVdaEarned),
    otAmount: toRupees(otAmount),
    ugAllowance: toRupees(e.ugAllowance),
    bonus: toRupees(e.bonus),
    edlis: toRupees(e.edlis),
    pli: toRupees(e.pli),
    otherEarnings: toRupees(e.otherEarnings),
    grossEarnings: toRupees(gross),
    epfDeduction: toRupees(epf),
    esiDeduction: toRupees(esi),
    otherDeduction: toRupees(e.otherDeduction),
    damageRecovery: toRupees(e.damageRecovery),
    totalDeduction: toRupees(totalDeduction),
    netEarnings: toRupees(net),
  };
}

/** Pick the rate in force on a date: the latest effectiveFrom <= onDate. Rates: [{ effectiveFrom: "YYYY-MM-DD", ... }] */
export function rateInForce(rates, onDate) {
  const eligible = rates.filter((r) => r.effectiveFrom <= onDate).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return eligible[0] ?? null;
}

/** First day of a pay month as "YYYY-MM-DD" (rates are looked up on this date). */
export const periodStart = (year, month) => `${year}-${String(month).padStart(2, "0")}-01`;
