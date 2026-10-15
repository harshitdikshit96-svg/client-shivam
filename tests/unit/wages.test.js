import { describe, it, expect } from "vitest";
import { computeWageLine, rateInForce, periodStart } from "@/lib/wages";

const rate = { basicDaily: 556, vdaDaily: 0 };
const statutory = { epfPercent: 12, esiPercent: 0.75, esiGrossCeiling: 21000 };

describe("computeWageLine — matches the client's existing CLIP wage sheet (Aug 2026)", () => {
  it.each([
    // days, gross, EPF, ESI, total deduction, net   (rows copied from the portal screenshot)
    [26, 14456, 1735, 108, 1843, 12613],
    [25, 13900, 1668, 104, 1772, 12128],
    [21, 11676, 1401, 88, 1489, 10187],
  ])("%i days → gross %i, net %i", (days, gross, epf, esi, total, net) => {
    const line = computeWageLine({ daysWorked: days, rate, statutory });
    expect(line.basicVdaEarned).toBe(gross);
    expect(line.grossEarnings).toBe(gross);
    expect(line.epfDeduction).toBe(epf);
    expect(line.esiDeduction).toBe(esi);
    expect(line.totalDeduction).toBe(total);
    expect(line.netEarnings).toBe(net);
  });
});

describe("computeWageLine — rules", () => {
  it("adds VDA to the daily rate", () => {
    expect(computeWageLine({ daysWorked: 10, rate: { basicDaily: 500, vdaDaily: 50 }, statutory }).basicVdaEarned).toBe(5500);
  });

  it("pays overtime at twice the hourly rate (8-hour day)", () => {
    // (556 / 8) × 2 × 1.5 h = 208.50
    const line = computeWageLine({ daysWorked: 0, otHours: 1, otMinutes: 30, rate, statutory });
    expect(line.otAmount).toBe(208.5);
  });

  it("includes typed extras in gross and typed deductions in total", () => {
    const line = computeWageLine({
      daysWorked: 26, rate, statutory,
      extras: { bonus: 500, pli: 250, otherDeduction: 100, damageRecovery: 50 },
    });
    expect(line.grossEarnings).toBe(14456 + 750);
    expect(line.totalDeduction).toBe(line.epfDeduction + line.esiDeduction + 150);
    expect(line.netEarnings).toBe(line.grossEarnings - line.totalDeduction);
  });

  it("charges no ESI above the gross ceiling", () => {
    const line = computeWageLine({ daysWorked: 30, rate: { basicDaily: 800 }, statutory }); // 24,000 > 21,000
    expect(line.esiDeduction).toBe(0);
  });

  it("caps EPF at the wage ceiling when one is set", () => {
    const line = computeWageLine({ daysWorked: 30, rate: { basicDaily: 800 }, statutory: { ...statutory, epfWageCeiling: 15000 } });
    expect(line.epfDeduction).toBe(1800);
  });

  it("handles half days without float drift", () => {
    expect(computeWageLine({ daysWorked: 25.5, rate, statutory }).basicVdaEarned).toBe(14178);
  });

  it.each([
    [{ daysWorked: 32 }, /daysWorked/],
    [{ daysWorked: -1 }, /daysWorked/],
    [{ daysWorked: 10, otMinutes: 20 }, /otMinutes/],
    [{ daysWorked: 10, otHours: -2 }, /otHours/],
    [{ daysWorked: 10, extras: { bonus: -5 } }, /bonus/],
  ])("rejects invalid input %o", (input, msg) => {
    expect(() => computeWageLine({ rate, statutory, ...input })).toThrow(msg);
  });

  it("requires a rate", () => {
    expect(() => computeWageLine({ daysWorked: 1, statutory })).toThrow(/wage rate/);
  });
});

describe("rateInForce", () => {
  const rates = [
    { id: 1, effectiveFrom: "2025-10-01" },
    { id: 2, effectiveFrom: "2026-04-01" },
    { id: 3, effectiveFrom: "2026-10-01" },
  ];
  it("uses the latest rate on or before the date", () => {
    expect(rateInForce(rates, "2026-08-01").id).toBe(2);
    expect(rateInForce(rates, "2026-10-01").id).toBe(3);
  });
  it("returns null before the first rate", () => {
    expect(rateInForce(rates, "2024-01-01")).toBeNull();
  });
  it("formats the period start", () => {
    expect(periodStart(2026, 8)).toBe("2026-08-01");
  });
});
