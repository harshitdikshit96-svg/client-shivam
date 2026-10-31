// Dispatch Register bill amounts, used by the form (live, as rates are picked) and by saveBill (stored).
//   Tax Amount = Taxable × Tax Rate %      GST Amount = Taxable × GST Rate %      Total = Taxable + Tax + GST
// In paise, rounded to the nearest paisa, so screen and database always agree.
export const TAX_RATES = ["0", "5", "18"];   // the drop-down choices; "Other" lets any rate 0–100 be typed

const paise = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.round(n * 100) : 0;
};
const rate = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const rupees = (p) => (p / 100).toFixed(2);

/** { taxable, taxRate, gstRate } (strings or numbers) → { tax, gst, total } as "1234.50" strings. */
export function billTotals({ taxable, taxRate, gstRate } = {}) {
  const base = paise(taxable);
  const tax = Math.round((base * rate(taxRate)) / 100);
  const gst = Math.round((base * rate(gstRate)) / 100);
  return { tax: rupees(tax), gst: rupees(gst), total: rupees(base + tax + gst) };
}
