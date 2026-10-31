// The statutory documents follow the client's formats exactly: headings character for character, and each value under
// its heading. The sample is one row of the client's own August 2026 Form D and the matching FORM VIII-C slip.
import { describe, it, expect } from "vitest";
import { formD, formDSheet, wageSlip, FORM_D_COLUMNS, amount, dmy, mask, stamp } from "@/lib/forms";
import { buildXlsx } from "@/lib/xlsx";

const LINE = { workmanId: 7, wuin: "1304999", skill: "Unskilled", attDays: 26, basic: 556, vda: 0, basicPay: 14456, ot: 0, ug: 0, bonus: 0, edlis: 0,
  pli: 0, otherEarn: 0, gross: 14456, epf: 1735, esi: 108, damage: 0, otherDed: 0, totalDed: 1843, net: 12613 };
const WORKMAN = { id: 7, fullName: "PALLIKALA SANYASI", relative: "PALLIKALA APPALSWAMI", designation: "LABOUR", bankAc: "31288056487", gis: "", uan: "102227192122" };
const FIRM = { name: "Vinyasa Infra Developers", cuin: "10011515", address: "MARGHERITA" };
const WO = { woNo: "GEMC-511687768623778", workName: "Hiring of services for sweeping and cleaning", start: "2026-06-15", end: "2026-10-30", peName: "Samson Bey", peDesig: "Manager(HR)",
  svName: "Harishchandra Singh" };
const SHEET = { year: 2026, month: 8, status: "approved", approvedAt: "2026-10-17T06:00:00.000Z", lines: [LINE] };
const NOW = new Date(2026, 9, 30, 14, 57, 6);

describe("Form D — wage statement", () => {
  const doc = formD({ firm: FIRM, wo: WO, sheet: SHEET, workmen: [WORKMAN], now: NOW });
  it("title and header table as in the format", () => {
    expect(doc.title).toBe("WAGE STATEMENT FOR THE MONTH OF AUGUST-2026");
    expect(doc.header).toEqual([
      ["Name of Firm/Establishment", "Vinyasa Infra Developers", "Name of Owner/Contractor", "Harishchandra Singh"],
      ["Work Order Reference No", "GEMC-511687768623778", "Name of the Work", "Hiring of services for sweeping and cleaning"],
      ["Date of Commencement", "15-06-2026", "Date of Completion", "30-10-2026"],
    ]);
  });
  it("the 25 column headings, in order, exactly as written", () => {
    expect(doc.columns).toEqual(["Name", "WUIN", "Designation", "Skill Category", "Attd. Days", "Basic Rate", "VDA Rate", "OT", "UG Allow.", "Bonus",
      "EDLIS", "PLI", "Other Earnings", "Gross Earnings", "EPF/CMPF Deduction", "CMPS Deduction", "ESI Deduction", "Fine", "Damage Recovery",
      "Other Deduction", "Total Deduction", "Net Earnings", "Bank A/C No", "Group Insurance Number", "EPF/CMPF Account Number"]);
  });
  it("each value sits under its heading (the client's row for PALLIKALA SANYASI)", () => {
    const row = Object.fromEntries(FORM_D_COLUMNS.map((h, i) => [h, doc.rows[0][i]]));
    expect(row).toEqual({
      "Name": "PALLIKALA SANYASI", "WUIN": "1304999", "Designation": "LABOUR", "Skill Category": "Unskilled", "Attd. Days": "26",
      "Basic Rate": "556", "VDA Rate": "0", "OT": "0", "UG Allow.": "0", "Bonus": "0", "EDLIS": "0", "PLI": "0", "Other Earnings": "0",
      "Gross Earnings": "14456", "EPF/CMPF Deduction": "1735", "CMPS Deduction": "0", "ESI Deduction": "108", "Fine": "0",
      "Damage Recovery": "0", "Other Deduction": "0", "Total Deduction": "1843", "Net Earnings": "12613", "Bank A/C No": "31288056487",
      "Group Insurance Number": "", "EPF/CMPF Account Number": "102227192122",
    });
  });
  it("Name of Owner/Contractor is the work order's contractor representative, or the firm name when that is blank", () => {
    expect(formD({ firm: FIRM, wo: { ...WO, svName: "" }, sheet: SHEET, workmen: [WORKMAN] }).header[0][3]).toBe("Vinyasa Infra Developers");
  });
  it("CMPS Deduction and Fine typed by the office sit under their headings", () => {
    const d = formD({ firm: FIRM, wo: WO, sheet: { ...SHEET, lines: [{ ...LINE, cmps: 40, fine: 25.5 }] }, workmen: [WORKMAN] });
    expect(d.rows[0][FORM_D_COLUMNS.indexOf("CMPS Deduction")]).toBe("40");
    expect(d.rows[0][FORM_D_COLUMNS.indexOf("Fine")]).toBe("25.50");
  });
  it("verification line and page footer", () => {
    expect(doc.verified).toBe("Paid Wages Verified By Samson Bey[Manager(HR)] on 17-10-2026");
    expect(doc.footer).toBe("Contractor CUIN : 10011515 | 30-10-2026 02:57:06 PM");
    expect(formD({ firm: FIRM, wo: WO, sheet: { ...SHEET, status: "submitted" }, workmen: [WORKMAN] }).verified).toMatch(/not yet approved/);
  });
  it("as an Excel sheet: same title, header, headings and row; amounts are numbers, account numbers keep every digit", () => {
    const sheet = formDSheet(doc);
    expect(sheet.rows[0][0].v).toBe(doc.title);
    expect([sheet.rows[2][0].v, sheet.rows[2][3].v, sheet.rows[2][10].v, sheet.rows[2][14].v]).toEqual(doc.header[0]);
    expect(sheet.rows[6].map((c) => c.v)).toEqual(FORM_D_COLUMNS);
    const r = sheet.rows[7];
    expect(r[13]).toEqual({ v: 14456, s: "num" });
    expect(r[22]).toEqual({ v: "31288056487", s: "cell" });
    expect(sheet.landscape).toBe(true);
  });
});

describe("FORM VIII-C — wage slip", () => {
  const doc = wageSlip({ firm: FIRM, sheet: SHEET, line: LINE, workman: WORKMAN, now: NOW });
  it("headings as in the format", () => {
    expect(doc.heading).toEqual(["Issuance of Wage Slip under Section 50(3) of Code on Wages, 2019", "FORM – VIII-C", "(See rule 156)", "Format for Wage Slip"]);
    expect([doc.dateOfIssue, doc.establishment, doc.address, doc.period]).toEqual(
      ["Date of issue: 30-10-2026", "Name of the Establishment: Vinyasa Infra Developers", "Address : MARGHERITA", "Period: August-2026"]);
    expect(doc.signature).toBe("Employer/Pay-in-charge signature");
  });
  it("the 12 items with the client's values", () => {
    const flat = doc.items.map(([no, label, v]) => [no, label, Array.isArray(v) ? v.map((p) => [p.label, p.value, p.note ?? null]) : v]);
    expect(flat).toEqual([
      ["1.", "Name of the Employee", "PALLIKALA SANYASI"],
      ["2.", "Father’s/Mother’s/Spouse’s Name", "PALLIKALA APPALSWAMI"],
      ["3.", "Designation", "LABOUR"],
      ["4.", "UAN", "XXXXXXXX2122"],
      ["5.", "Bank Account Number", "*******6487"],
      ["6.", "Wage period", "August-2026"],
      ["7.", "Rate of wages payable", [["a) Basic :", "14456", "( Daily Basic: 556 )"], ["b) D.A. :", "0", "( Daily DA: 0 )"], ["c) Other Allowances :", "0", null]]],
      ["8.", "Total attendance / unit of work done", "26"],
      ["9.", "Overtime wages", "0"],
      ["10.", "Gross wages payable", "14456"],
      ["11.", "Total deductions", [["a) PF :", "1735", null], ["b) ESI :", "108", null], ["c) Others :", "0", null]]],
      ["12.", "Net wages paid", "12613"],
    ]);
  });
  it("D.A. and allowances when the order pays VDA and extras", () => {
    const d = wageSlip({ firm: FIRM, sheet: SHEET, line: { ...LINE, vda: 100, basicPay: 17056, ug: 50, bonus: 25.5, otherDed: 10, damage: 5, cmps: 40, fine: 20 }, workman: WORKMAN, now: NOW });
    const [, , rate] = d.items[6];
    expect(rate.map((p) => p.value)).toEqual(["14456", "2600", "75.50"]);
    expect(d.items[10][2][2].value).toBe("75");   // Others = CMPS + Fine + Damage Recovery + Other Deduction
  });
});

describe("helpers", () => {
  it("amounts, dates, masks, time stamp", () => {
    expect([amount(14456), amount("1234.5"), amount(null), amount(0)]).toEqual(["14456", "1234.50", "0", "0"]);
    expect(dmy("2026-06-15")).toBe("15-06-2026");
    expect([mask("102227192122", "X"), mask("31288056487", "*"), mask("", "*"), mask("123", "*")]).toEqual(["XXXXXXXX2122", "*******6487", "", "123"]);
    expect(stamp(new Date(2026, 0, 5, 0, 7, 9))).toBe("05-01-2026 12:07:09 AM");
  });
});

describe("the .xlsx file", () => {
  // read a stored (uncompressed) zip: name → text
  const unzip = (bytes) => {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = {};
    for (let at = 0; dv.getUint32(at, true) === 0x04034b50;) {
      const size = dv.getUint32(at + 18, true), nameLen = dv.getUint16(at + 26, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen));
      out[name] = new TextDecoder().decode(bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size));
      at += 30 + nameLen + size;
    }
    return out;
  };
  it("is a workbook whose sheet holds the Form D headings and values, with text kept as text", () => {
    const doc = formD({ firm: FIRM, wo: { ...WO, workName: "Cleaning & sweeping <NEC>" }, sheet: SHEET, workmen: [{ ...WORKMAN, bankAc: "0018201700022360" }], now: NOW });
    const files = unzip(buildXlsx(formDSheet(doc)));
    expect(Object.keys(files)).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]);
    const s = files["xl/worksheets/sheet1.xml"];
    expect(s).toContain("WAGE STATEMENT FOR THE MONTH OF AUGUST-2026");
    expect(s).toContain("Cleaning &amp; sweeping &lt;NEC&gt;");
    expect(s).toContain('<t xml:space="preserve">0018201700022360</t>');   // leading zeros kept
    expect(s).toContain("<v>14456</v>");
    expect(s).toContain('orientation="landscape"');
    let last = -1;
    for (const h of FORM_D_COLUMNS) { const i = s.indexOf(`>${h.replace(/&/g, "&amp;")}</t>`); expect(i, h).toBeGreaterThan(last); last = i; }
  });
});
