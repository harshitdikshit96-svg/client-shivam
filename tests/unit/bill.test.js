// Dispatch Register amounts (lib/bill.js): one tax only (CR-11) — Total = Taxable + Taxable × GST Rate %.
import { describe, it, expect } from "vitest";
import { billTotals, GST_RATES } from "@/lib/bill";
import * as bill from "@/lib/bill";

describe("bill totals", () => {
  it("the GST drop-down offers 0%, 5% and 18%", () => expect(GST_RATES).toEqual(["0", "5", "18"]));
  it("adds GST to the taxable amount; there is no separate tax (CR-11)", () => {
    expect(billTotals({ taxable: "100000", gstRate: "18" })).toEqual({ gst: "18000.00", total: "118000.00" });
    expect(billTotals({ taxable: "60000", gstRate: "5" })).toEqual({ gst: "3000.00", total: "63000.00" });
    // a stray tax rate (an old screen, an API call) changes nothing
    expect(billTotals({ taxable: "100000", taxRate: "5", gstRate: "18" })).toEqual({ gst: "18000.00", total: "118000.00" });
    expect(bill.TAX_RATES).toBeUndefined();
  });
  it("an 'Other' rate with decimals, rounded to the paisa", () => {
    expect(billTotals({ taxable: "999.99", gstRate: "12" })).toEqual({ gst: "120.00", total: "1119.99" });
    expect(billTotals({ taxable: "33.33", gstRate: "18" }).gst).toBe("6.00");
  });
  it("blank or unfinished values count as 0 while typing", () => {
    expect(billTotals({})).toEqual({ gst: "0.00", total: "0.00" });
    expect(billTotals({ taxable: "1000", gstRate: "abc" })).toEqual({ gst: "0.00", total: "1000.00" });
  });
});
