// Dispatch Register amounts (lib/bill.js): Total = Taxable + Taxable × Tax Rate % + Taxable × GST Rate %.
import { describe, it, expect } from "vitest";
import { billTotals, TAX_RATES } from "@/lib/bill";

describe("bill totals", () => {
  it("the drop-down offers 0%, 5% and 18%", () => expect(TAX_RATES).toEqual(["0", "5", "18"]));
  it("adds both taxes to the taxable amount", () => {
    expect(billTotals({ taxable: "100000", taxRate: "5", gstRate: "18" })).toEqual({ tax: "5000.00", gst: "18000.00", total: "123000.00" });
    expect(billTotals({ taxable: "60000", taxRate: "0", gstRate: "18" })).toEqual({ tax: "0.00", gst: "10800.00", total: "70800.00" });
  });
  it("an 'Other' rate with decimals, rounded to the paisa", () => {
    expect(billTotals({ taxable: "999.99", taxRate: "2.5", gstRate: "12" })).toEqual({ tax: "25.00", gst: "120.00", total: "1144.99" });
    expect(billTotals({ taxable: "33.33", taxRate: "0", gstRate: "18" }).gst).toBe("6.00");
  });
  it("blank or unfinished values count as 0 while typing", () => {
    expect(billTotals({})).toEqual({ tax: "0.00", gst: "0.00", total: "0.00" });
    expect(billTotals({ taxable: "1000", taxRate: "", gstRate: "abc" })).toEqual({ tax: "0.00", gst: "0.00", total: "1000.00" });
  });
});
