// Dispatch Register bill amounts, used by the form (live, as rates are picked) and by saveBill (stored).
//   GST Amount = Taxable × GST Rate %      Total = Taxable + GST   (one tax only: GST, CR-11)
// In paise, rounded to the nearest paisa, so screen and database always agree.
export const GST_RATES = ["0", "5", "18"];   // the drop-down choices; "Other" lets any rate 0–100 be typed

const paise = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.round(n * 100) : 0;
};
const rate = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const rupees = (p) => (p / 100).toFixed(2);

/** { taxable, gstRate } (strings or numbers) → { gst, total } as "1234.50" strings. */
export function billTotals({ taxable, gstRate } = {}) {
  const base = paise(taxable);
  const gst = Math.round((base * rate(gstRate)) / 100);
  return { gst: rupees(gst), total: rupees(base + gst) };
}
