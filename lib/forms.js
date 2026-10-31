// The statutory documents, laid out exactly like the client's sample PDFs (shared 31 Oct 2026; not kept in the repo
// because they hold real workers' bank details):
//   Form D  — WAGE STATEMENT FOR THE MONTH OF … (one work order, one month, every workman)
//   FORM VIII-C — Wage Slip under Section 50(3) of the Code on Wages, 2019 (one workman, one month)
// Each builder returns plain data (headings + values); the screen, the print view and the Excel file all draw from it,
// so headings never drift between them. Headings are copied from the formats character for character.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 14456 → "14456", 1234.5 → "1234.50", null → "0" (the formats print whole rupees without separators). */
export const amount = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
/** "2026-06-15" → "15-06-2026" */
export const dmy = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "");
/** August-2026 (slip) / AUGUST-2026 (statement title) */
export const periodText = (year, month, upper = false) => {
  const t = `${MONTHS[month - 1]}-${year}`;
  return upper ? t.toUpperCase() : t;
};
/** "30-10-2026 02:57:06 PM" */
export const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  const h = d.getHours() % 12 || 12;
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
};
/** Keep the last 4 characters: UAN "XXXXXXXX2122", bank account "*******6487". */
export const mask = (v, ch) => {
  const s = String(v ?? "").trim();
  return s.length > 4 ? ch.repeat(s.length - 4) + s.slice(-4) : s;
};

// ---------------------------------------------------------------- Form D
export const FORM_D_COLUMNS = [
  "Name", "WUIN", "Designation", "Skill Category", "Attd. Days", "Basic Rate", "VDA Rate", "OT", "UG Allow.", "Bonus", "EDLIS", "PLI",
  "Other Earnings", "Gross Earnings", "EPF/CMPF Deduction", "CMPS Deduction", "ESI Deduction", "Fine", "Damage Recovery",
  "Other Deduction", "Total Deduction", "Net Earnings", "Bank A/C No", "Group Insurance Number", "EPF/CMPF Account Number",
];
/** Columns that hold numbers (right for Excel sums); the rest are text (names, WUIN, account numbers keep every digit). */
export const FORM_D_NUMBER_COLUMNS = new Set(FORM_D_COLUMNS.map((c, i) => [c, i]).filter(([c]) => !["Name", "WUIN", "Designation", "Skill Category", "Bank A/C No", "Group Insurance Number", "EPF/CMPF Account Number"].includes(c)).map(([, i]) => i));

/**
 * firm: { name, cuin }   wo: { woNo, workName, start, end, peName, peDesig, svName }
 * sheet: { year, month, status, approvedAt, lines: [...] }   workmen: [{ id, fullName, designation, bankAc, gis, uan }]
 */
export function formD({ firm, wo, sheet, workmen, now = new Date() }) {
  const byId = new Map(workmen.map((w) => [w.id, w]));
  const rows = sheet.lines.map((l) => {
    const w = byId.get(l.workmanId) ?? {};
    return [
      w.fullName ?? l.name ?? "", l.wuin ?? w.wuin ?? "", w.designation ?? "", l.skill ?? w.skill ?? "",
      amount(l.attDays), amount(l.basic), amount(l.vda), amount(l.ot), amount(l.ug), amount(l.bonus), amount(l.edlis), amount(l.pli),
      amount(l.otherEarn), amount(l.gross), amount(l.epf), amount(l.cmps), amount(l.esi), amount(l.fine), amount(l.damage),
      amount(l.otherDed), amount(l.totalDed), amount(l.net), w.bankAc ?? "", w.gis ?? "", w.uan ?? "",
    ];
  });
  const approved = sheet.status === "approved" && sheet.approvedAt;
  return {
    title: `WAGE STATEMENT FOR THE MONTH OF ${periodText(sheet.year, sheet.month, true)}`,
    header: [
      // the contractor's person is the work order's "Name of the supervisor / Auth. Personnel representing the contractor"
      ["Name of Firm/Establishment", firm?.name ?? "", "Name of Owner/Contractor", wo?.svName || firm?.name || ""],
      ["Work Order Reference No", wo?.woNo ?? "", "Name of the Work", wo?.workName ?? ""],
      ["Date of Commencement", dmy(wo?.start), "Date of Completion", dmy(wo?.end)],
    ],
    columns: FORM_D_COLUMNS,
    rows,
    verified: approved
      ? `Paid Wages Verified By ${wo?.peName ?? ""}${wo?.peDesig ? `[${wo.peDesig}]` : ""} on ${dmy(sheet.approvedAt)}`
      : "Paid Wages Verified By — (not yet approved)",
    footer: `Contractor CUIN : ${firm?.cuin ?? ""} | ${stamp(now)}`,
  };
}

// ---------------------------------------------------------------- FORM VIII-C wage slip
/**
 * firm: { name, address }   sheet: { year, month }   line: one saved wage line   workman: { fullName, relative, designation, uan, bankAc }
 * Basic and D.A. are the month's amounts (rate × days); the daily rates are shown under them, as in the format.
 */
export function wageSlip({ firm, sheet, line: l, workman: w, now = new Date() }) {
  const days = Number(l.attDays ?? 0);
  const basic = Math.round(Number(l.basic ?? 0) * days * 100) / 100;
  const da = Math.round((Number(l.basicPay ?? 0) - basic) * 100) / 100;
  const allowances = ["ug", "bonus", "edlis", "pli", "otherEarn"].reduce((t, k) => t + Number(l[k] ?? 0), 0);
  const others = ["cmps", "fine", "damage", "otherDed"].reduce((t, k) => t + Number(l[k] ?? 0), 0);
  const period = periodText(sheet.year, sheet.month);
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    heading: ["Issuance of Wage Slip under Section 50(3) of Code on Wages, 2019", "FORM – VIII-C", "(See rule 156)", "Format for Wage Slip"],
    dateOfIssue: `Date of issue: ${dmy(iso)}`,
    establishment: `Name of the Establishment: ${firm?.name ?? ""}`,
    address: `Address : ${firm?.address ?? ""}`,
    period: `Period: ${period}`,
    items: [
      ["1.", "Name of the Employee", w?.fullName ?? l.name ?? ""],
      ["2.", "Father’s/Mother’s/Spouse’s Name", w?.relative ?? ""],
      ["3.", "Designation", w?.designation ?? ""],
      ["4.", "UAN", mask(w?.uan, "X")],
      ["5.", "Bank Account Number", mask(w?.bankAc, "*")],
      ["6.", "Wage period", period],
      ["7.", "Rate of wages payable", [
        { label: "a) Basic :", value: amount(basic), note: `( Daily Basic: ${amount(l.basic)} )` },
        { label: "b) D.A. :", value: amount(da), note: `( Daily DA: ${amount(l.vda)} )` },
        { label: "c) Other Allowances :", value: amount(allowances) },
      ]],
      ["8.", "Total attendance / unit of work done", amount(days)],
      ["9.", "Overtime wages", amount(l.ot)],
      ["10.", "Gross wages payable", amount(l.gross)],
      ["11.", "Total deductions", [
        { label: "a) PF :", value: amount(l.epf) },
        { label: "b) ESI :", value: amount(l.esi) },
        { label: "c) Others :", value: amount(others) },
      ]],
      ["12.", "Net wages paid", amount(l.net)],
    ],
    signature: "Employer/Pay-in-charge signature",
  };
}

/**
 * Form D as an Excel sheet, in the layout of the format: title, the 3-line header table, the 25 column headings,
 * one row per workman, then the verification line and the CUIN / time stamp. Amount columns are numbers (they add up
 * in Excel); names, WUIN and account numbers are text (every digit kept).
 */
export function formDSheet(doc) {
  const last = doc.columns.length - 1;   // column Y
  const L = (i) => String.fromCharCode(65 + i);
  const rows = [
    [{ v: doc.title, s: "title" }],
    [],
    ...doc.header.map(([a, b, c, d]) => {
      const r = new Array(doc.columns.length).fill(null);
      r[0] = { v: a, s: "label" }; r[1] = { v: "", s: "label" }; r[2] = { v: "", s: "label" };
      for (let i = 3; i <= 9; i++) r[i] = { v: i === 3 ? b : "", s: "cell" };
      r[10] = { v: c, s: "label" }; for (let i = 11; i <= 13; i++) r[i] = { v: "", s: "label" };
      for (let i = 14; i <= last; i++) r[i] = { v: i === 14 ? d : "", s: "cell" };
      return r;
    }),
    [],
    doc.columns.map((h) => ({ v: h, s: "head" })),
    ...doc.rows.map((r) => r.map((v, i) => (FORM_D_NUMBER_COLUMNS.has(i) ? { v: Number(v), s: "num" } : { v, s: "cell" }))),
    [],
    [{ v: doc.verified, s: "label" }],
    [],
    [{ v: doc.footer }],
  ];
  const merges = [`A1:${L(last)}1`, ...[3, 4, 5].flatMap((n) => [`A${n}:C${n}`, `D${n}:J${n}`, `K${n}:N${n}`, `O${n}:${L(last)}${n}`])];
  const widths = [22, 10, 12, 10, 6, 7, 6, 6, 7, 7, 7, 6, 9, 9, 10, 9, 9, 6, 9, 9, 9, 9, 19, 11, 14];
  return { name: "Wage Statement", rows, merges, widths, landscape: true };
}
