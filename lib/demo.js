// Dummy data for a one-off end-to-end check. Every name starts with "Demo" so it can't be mistaken for real data.
// Goes through the real service layer (lib/payroll.js), so it exercises the same code the screens will use.
//   npm run db:demo     load it and print a report      npm run db:reset -- --yes   wipe everything afterwards
import { and, eq } from "drizzle-orm";
import {
  firms, workOrders, workOrderConfig, workOrderRates, workmen, engagements, monthlySheets, wageLines, dispatchRegister,
} from "../db/schema.js";
import { saveWageLine, recalculateSheet, submitSheet } from "./payroll.js";
import { OPS } from "./ops.js";

// Fills every screen: ongoing, pending, rejected and completed work orders; active, inactive, moved-out and
// not-yet-engaged workmen; approved, submitted and draft wage months; paid, part-paid and pending bills.

const pad = (n) => String(n).padStart(2, "0");
// realistic names (letters only, as the Name field requires); every one starts with "Demo"
const FIRST = ["Ramesh", "Suresh", "Anita", "Mahesh", "Rakesh", "Sunita", "Dinesh", "Ganesh", "Prakash", "Kavita", "Manoj"];
const demoName = (n) => `Demo ${FIRST[n - 1]}`;
const demoParent = (n) => `Demo ${FIRST[(n + 4) % FIRST.length]} Senior`;

const FIRMS = [
  { name: "Demo Security Services Pvt Ltd", cuin: "DEMO-1001", state: "Uttar Pradesh", pincode: "226010", mobile: "9000000001", email: "demo1@example.com" },
  { name: "Demo Manpower Agency", cuin: "DEMO-1002", state: "Assam", pincode: "786181", mobile: "9000000002", email: "demo2@example.com" },
];

const ORDER_BASE = {
  company: "Demo Company Ltd", principalEmployerName: "Demo Principal Employer", principalEmployerDesignation: "Area Manager",
  principalEmployerContact: "9000000100", district: "Tinsukia", commencementDate: "2026-06-15", completionDate: "2027-03-31",
};

// firm index → orders. The same order number "DEMO-WO-001" is used in both firms on purpose (allowed: unique per firm).
const ORDERS = [
  { firm: 0, woNumber: "DEMO-WO-001", nameOfWork: "Demo sweeping and cleaning", state: "Assam", natureOfWork: "Others", status: "approved",
    config: { deadlineDay: 20 }, rates: { Unskilled: { basicDaily: "556" }, "Semi Skilled": { basicDaily: "620" } } },
  { firm: 0, woNumber: "DEMO-WO-002", nameOfWork: "Demo watch and ward", state: "Uttar Pradesh", natureOfWork: "Watch and Ward", status: "approved",
    config: { epfPercent: "12", esiGrossCeiling: null, otMultiplier: "2" }, rates: { Skilled: { basicDaily: "700", vdaDaily: "50" } } },
  { firm: 0, woNumber: "DEMO-WO-003", nameOfWork: "Demo civil maintenance", state: "Uttar Pradesh", natureOfWork: "Civil", status: "pending",
    config: {}, rates: { Unskilled: { basicDaily: "500" } } },
  { firm: 1, woNumber: "DEMO-WO-001", nameOfWork: "Demo coal loading", state: "Assam", natureOfWork: "Coal Loading and Transportation", status: "approved",
    config: { epfPercent: "10" }, rates: { Unskilled: { basicDaily: "600" } } },
  // index 4–6: the other states, so every work order list has rows
  { firm: 0, woNumber: "DEMO-WO-004", nameOfWork: "Demo canteen services", state: "Uttar Pradesh", natureOfWork: "Others", status: "rejected",
    config: {}, rates: { Unskilled: { basicDaily: "520" } }, remarks: "Rejected: rate sheet missing" },
  { firm: 0, woNumber: "DEMO-WO-005", nameOfWork: "Demo parking management", state: "Uttar Pradesh", natureOfWork: "Watch and Ward", status: "completed",
    config: {}, rates: { Unskilled: { basicDaily: "540" } }, commencementDate: "2026-04-01", completionDate: "2026-06-30" },
  { firm: 1, woNumber: "DEMO-WO-002", nameOfWork: "Demo conveyor maintenance", state: "Assam", natureOfWork: "E & M", status: "pending",
    config: {}, rates: { Skilled: { basicDaily: "720" } } },
];

// firm index, order index (engaged on), skill
const WORKERS = [
  { firm: 0, order: 0, skill: "Unskilled" },
  { firm: 0, order: 0, skill: "Unskilled" },
  { firm: 0, order: 0, skill: "Unskilled" },
  { firm: 0, order: 0, skill: "Semi Skilled" },
  { firm: 0, order: 1, skill: "Skilled" },
  { firm: 0, order: 1, skill: "Skilled" },
  { firm: 1, order: 3, skill: "Unskilled" },
  { firm: 1, order: 3, skill: "Unskilled" },
];

// August 2026 (submitted). The first three rows are the client's real CLIP August sheet: 26 / 25 / 21 days at ₹556.
const AUGUST = [
  { worker: 0, daysWorked: 26 },
  { worker: 1, daysWorked: 25 },
  { worker: 2, daysWorked: 21 },
  { worker: 3, daysWorked: 24, otHours: 4, otMinutes: 30, bonus: 500 },
  { worker: 4, daysWorked: 30, otHours: 10, damageRecovery: 250 },
  { worker: 5, daysWorked: 28.5, pli: 300, otherDeduction: 100 },
  { worker: 6, daysWorked: 26 },
  { worker: 7, daysWorked: 20, ugAllowance: 200 },
];

/** Load everything. Returns ids and the expected-vs-actual checks. */
export async function loadDemoData(db) {
  const firmRows = [];
  for (const f of FIRMS) firmRows.push((await db.insert(firms).values(f).returning())[0]);

  const orderRows = [];
  for (const o of ORDERS) {
    const [wo] = await db.insert(workOrders).values({
      ...ORDER_BASE, district: o.state === "Assam" ? "Tinsukia" : "Lucknow", firmId: firmRows[o.firm].id, woNumber: o.woNumber, nameOfWork: o.nameOfWork,
      state: o.state, natureOfWork: o.natureOfWork, status: o.status, engineerInCharge: "Demo Engineer",
      supervisorName: "Demo Supervisor", supervisorPhone: "9000000300", areaOfOperation: "Surface", remarks: o.remarks ?? null,
      ...(o.commencementDate ? { commencementDate: o.commencementDate, completionDate: o.completionDate } : {}),
    }).returning();
    await db.insert(workOrderConfig).values({ workOrderId: wo.id, ...o.config });
    for (const [skillCategory, r] of Object.entries(o.rates)) await db.insert(workOrderRates).values({ workOrderId: wo.id, skillCategory, ...r });
    orderRows.push(wo);
  }

  const workerRows = [];
  for (const [i, w] of WORKERS.entries()) {
    const n = i + 1;
    const [row] = await db.insert(workmen).values({
      firmId: firmRows[w.firm].id, wuin: `DEMO-W${pad(n)}`, aadhaar: `9999000000${pad(n)}`, name: demoName(n),
      surname: "Test", gender: n % 3 === 0 ? "Female" : "Male", relativeName: demoParent(n), dateOfBirth: `199${n % 10}-01-15`,
      dateOfJoining: "2026-07-01", designation: w.skill === "Skilled" ? "GUARD" : "LABOUR", skillCategory: w.skill, pfType: "EPF",
      bankAccountNo: `00000000${pad(n)}`, bankName: "Demo Bank", ifsc: "DEMO0000001", address: "Demo Address, Lucknow",
      accommodation: ["Self", "Company Quarter", "Contractors' camp"][n % 3], mobile: `90000002${pad(n)}`,
    }).returning();
    await db.insert(engagements).values({ firmId: row.firmId, workmanId: row.id, workOrderId: orderRows[w.order].id, engagedFrom: "2026-07-01" });
    workerRows.push(row);
  }

  // July (approved) for order 1, at the original ₹556
  const [july] = await db.insert(monthlySheets).values({ workOrderId: orderRows[0].id, year: 2026, month: 7 }).returning();
  for (const [i, days] of [[0, 27], [1, 26], [2, 24], [3, 26]]) await saveWageLine(db, july.id, workerRows[i].id, { daysWorked: days });
  await submitSheet(db, july.id);
  await db.update(monthlySheets).set({ status: "approved", approvedAt: new Date("2026-08-12T10:00:00Z") }).where(eq(monthlySheets.id, july.id));

  // August: type days → wages calculate → submit (locks the month)
  const sheets = {};
  for (const wo of [orderRows[0], orderRows[1], orderRows[3]]) {
    sheets[wo.id] = (await db.insert(monthlySheets).values({ workOrderId: wo.id, year: 2026, month: 8 }).returning())[0];
  }
  for (const a of AUGUST) {
    const { worker, ...input } = a;
    const w = workerRows[worker];
    const wo = orderRows[WORKERS[worker].order];
    await saveWageLine(db, sheets[wo.id].id, w.id, input);
  }
  for (const s of Object.values(sheets)) await submitSheet(db, s.id);

  // September (draft) for order 1, then the Per Day Wage is revised 556 → 600 and the draft month recalculated
  const [sept] = await db.insert(monthlySheets).values({ workOrderId: orderRows[0].id, year: 2026, month: 9 }).returning();
  await saveWageLine(db, sept.id, workerRows[0].id, { daysWorked: 26 });
  await db.update(workOrderRates).set({ basicDaily: "600" })
    .where(and(eq(workOrderRates.workOrderId, orderRows[0].id), eq(workOrderRates.skillCategory, "Unskilled")));
  await recalculateSheet(db, sept.id);
  await db.update(monthlySheets).set({ deadline: "2026-10-20" }).where(eq(monthlySheets.id, sept.id));

  // Completed order 5 (Apr–Jun): two workmen, May and June approved. Afterwards one is inactive (engagement ended)
  // and one has left (date of exit) → "View Inactive Workmen" and "Workmen Moved Out". A new joiner is not engaged yet.
  const wo5 = orderRows[5];
  const extra = [];
  for (const [n, over] of [[9, {}], [10, {}], [11, { dateOfJoining: "2026-10-01" }]]) {
    const [row] = await db.insert(workmen).values({
      firmId: firmRows[0].id, wuin: `DEMO-W${pad(n)}`, aadhaar: `9999000000${pad(n)}`, name: demoName(n), surname: "Test",
      gender: n === 10 ? "Female" : "Male", relativeName: demoParent(n), dateOfBirth: "1988-05-20", dateOfJoining: "2026-04-01",
      designation: "PARKING ATTENDANT", skillCategory: "Unskilled", pfType: "EPF", bankAccountNo: `00000000${pad(n)}`, bankName: "Demo Bank",
      ifsc: "DEMO0000001", address: "Demo Address, Lucknow", accommodation: "Self", mobile: `90000002${pad(n)}`, ...over,
    }).returning();
    extra.push(row);
  }
  for (const w of extra.slice(0, 2)) {
    await db.insert(engagements).values({ firmId: w.firmId, workmanId: w.id, workOrderId: wo5.id, engagedFrom: "2026-04-01", engagedTo: "2026-06-30" });
  }
  for (const [month, days] of [[5, [26, 25]], [6, [24, 26]]]) {
    const [s] = await db.insert(monthlySheets).values({ workOrderId: wo5.id, year: 2026, month }).returning();
    for (const [i, d] of days.entries()) await saveWageLine(db, s.id, extra[i].id, { daysWorked: d });
    await submitSheet(db, s.id);
    await db.update(monthlySheets).set({ status: "approved", approvedAt: new Date(`2026-0${month + 1}-10T10:00:00Z`) }).where(eq(monthlySheets.id, s.id));
  }
  await db.update(workmen).set({ dateOfExit: "2026-07-15" }).where(eq(workmen.id, extra[1].id));

  // Dispatch register
  await db.insert(dispatchRegister).values([
    { firmId: firmRows[0].id, workOrderId: orderRows[0].id, partyNameContract: "Demo Company Ltd / DEMO-WO-001", billNumber: "DEMO-BILL-01",
      billDate: "2026-09-05", taxableAmount: "60000", gstAmount: "10800", receivedAmount: "68000", receivedDate: "2026-09-25", deduction: "2800",
      gstPaymentStatus: "Paid", epfPaymentStatus: "Paid", esicPaymentStatus: "Pending", approved: true, approvedBy: "Demo Approver", approvalDate: "2026-09-26" },
    { firmId: firmRows[0].id, workOrderId: orderRows[1].id, partyNameContract: "Demo Company Ltd / DEMO-WO-002", billNumber: "DEMO-BILL-02",
      billDate: "2026-09-05", taxableAmount: "52000", gstAmount: "9360" },
    { firmId: firmRows[1].id, workOrderId: orderRows[3].id, partyNameContract: "Demo Company Ltd / DEMO-WO-001", billNumber: "DEMO-BILL-01",
      billDate: "2026-09-07", taxableAmount: "31000", gstAmount: "5580" },
    { firmId: firmRows[0].id, workOrderId: orderRows[5].id, partyNameContract: "Demo Company Ltd / DEMO-WO-005", billNumber: "DEMO-BILL-03",
      billDate: "2026-07-05", taxableAmount: "28000", gstAmount: "5040", receivedAmount: "20000", receivedDate: "2026-08-01",
      gstPaymentStatus: "Partially Paid", epfPaymentStatus: "Paid", esicPaymentStatus: "Paid", remark: "Balance due after audit" },
  ]);

  return { firms: firmRows, orders: orderRows, workers: workerRows, extraWorkers: extra, augustSheets: sheets, septSheet: sept, julySheet: july };
}

/** Each check: what the rule is, whether it held. Used by the script report and by tests/db/demo.test.js. */
export async function runDemoChecks(db, ids) {
  const checks = [];
  const add = (rule, ok, detail = "") => checks.push({ rule, ok, detail });
  const line = async (sheet, worker) => (await db.select().from(wageLines)
    .where(and(eq(wageLines.sheetId, sheet.id), eq(wageLines.workmanId, worker.id))))[0];
  const expectReject = async (rule, fn) => {
    try { await fn(); add(rule, false, "was accepted"); } catch (e) { add(rule, true, String(e.message).split("\n")[0].slice(0, 90)); }
  };

  const [wo1, wo2, , wo4] = ids.orders;
  const w = ids.workers;
  const aug1 = ids.augustSheets[wo1.id];

  const l0 = await line(aug1, w[0]);
  add("26 days × ₹556 → net ₹12,613 (matches client's CLIP sheet)", l0.netEarnings === "12613.00", `gross ${l0.grossEarnings}, EPF ${l0.epfDeduction}, ESI ${l0.esiDeduction}, net ${l0.netEarnings}`);
  const l1 = await line(aug1, w[1]);
  add("25 days → net ₹12,128", l1.netEarnings === "12128.00", `net ${l1.netEarnings}`);
  const l2 = await line(aug1, w[2]);
  add("21 days → net ₹10,187", l2.netEarnings === "10187.00", `net ${l2.netEarnings}`);
  const l3 = await line(aug1, w[3]);
  add("Semi Skilled uses its own rate (₹620) + OT 4h30m + bonus", l3.basicRate === "620.00" && l3.otAmount === "697.50" && l3.bonus === "500.00", `OT ${l3.otAmount}, gross ${l3.grossEarnings}`);
  const l4 = await line(ids.augustSheets[wo2.id], w[4]);
  add("WO-002 Config: ₹700 + VDA ₹50, no ESI limit → ESI charged above ₹21,000", l4.basicVdaEarned === "22500.00" && Number(l4.esiDeduction) > 0, `gross ${l4.grossEarnings}, ESI ${l4.esiDeduction}`);
  const l6 = await line(ids.augustSheets[wo4.id], w[6]);
  add("Other firm's order uses its own Config (EPF 10%)", l6.epfPercent === "10.00" && l6.epfDeduction === "1560.00", `EPF ${l6.epfDeduction} on ${l6.basicVdaEarned}`);
  add("Half days work (28.5 days)", (await line(ids.augustSheets[wo2.id], w[5])).daysWorked === "28.5");

  const sept = await line(ids.septSheet, w[0]);
  add("Rate revised to ₹600 → draft September recalculated", sept.basicRate === "600.00" && sept.basicVdaEarned === "15600.00", `Sept basic ${sept.basicRate}`);
  add("…while submitted August keeps ₹556", (await line(aug1, w[0])).basicRate === "556.00");

  await expectReject("Submitted month cannot be edited", () => saveWageLine(db, aug1.id, w[0].id, { daysWorked: 10 }));
  await expectReject("32 days is rejected", () => saveWageLine(db, ids.septSheet.id, w[1].id, { daysWorked: 32 }));
  await expectReject("OT minutes must be 0/15/30/45", () => saveWageLine(db, ids.septSheet.id, w[1].id, { daysWorked: 10, otMinutes: 20 }));
  await expectReject("Worker not engaged on the order is refused", () => saveWageLine(db, ids.septSheet.id, w[4].id, { daysWorked: 10 }));
  await expectReject("Worker cannot be engaged on another firm's order", () =>
    db.insert(engagements).values({ firmId: wo4.firmId, workmanId: w[0].id, workOrderId: wo4.id, engagedFrom: "2026-10-01" }));
  await expectReject("A worker can't have two open engagements", () =>
    db.insert(engagements).values({ firmId: wo2.firmId, workmanId: w[0].id, workOrderId: wo2.id, engagedFrom: "2026-10-01" }));
  // Aadhaar is editable; a duplicate within the firm is refused by the rule in lib/rules.js (not a database key)
  const asForm = (await OPS.getWorkman(db, { firmId: w[1].firmId, workmanId: w[1].id })).values;
  try {
    await OPS.updateWorkman(db, { firmId: w[1].firmId, workmanId: w[1].id, values: { ...asForm, details: { ...asForm.details, aadhaar: w[0].aadhaar } } });
    add("Duplicate Aadhaar in the same firm is refused", false, "was accepted");
  } catch (e) {
    add("Duplicate Aadhaar in the same firm is refused", /already registered.*DEMO-W01/.test(e.message), e.message);
  }
  await expectReject("Duplicate order number in the same firm is refused", () =>
    db.insert(workOrders).values({ ...ORDER_BASE, firmId: wo1.firmId, woNumber: "DEMO-WO-001", nameOfWork: "dup", state: "Assam" }));
  add("Same order number allowed in a different firm", wo4.woNumber === wo1.woNumber && wo4.firmId !== wo1.firmId);
  add("Approved July keeps ₹556 after the rate revision", (await line(ids.julySheet, w[0])).basicRate === "556.00");
  const [moved] = await db.select().from(workmen).where(eq(workmen.id, ids.extraWorkers[1].id));
  add("A workman with a date of exit is kept (moved out), not deleted", moved?.dateOfExit === "2026-07-15");


  return checks;
}


/** Small summary tables for the report. */
export async function demoSummary(db) {
  const f = await db.select().from(firms);
  const o = await db.select().from(workOrders);
  const w = await db.select().from(workmen);
  const s = await db.select().from(monthlySheets);
  const l = await db.select().from(wageLines);
  const firmName = (id) => f.find((x) => x.id === id)?.name;
  const order = (sheetId) => o.find((x) => x.id === s.find((y) => y.id === sheetId)?.workOrderId);
  return {
    counts: {
      firms: f.length, workOrders: o.length, workmen: w.length,
      engagements: (await db.select().from(engagements)).length, monthlySheets: s.length, wageLines: l.length,
      bills: (await db.select().from(dispatchRegister)).length,
    },
    wageLines: l.map((x) => {
      const sheet = s.find((y) => y.id === x.sheetId);
      return {
        firm: firmName(order(x.sheetId)?.firmId)?.replace(/^Demo /, ""), order: order(x.sheetId)?.woNumber,
        month: `${sheet.year}-${pad(sheet.month)} ${sheet.status}`, worker: w.find((y) => y.id === x.workmanId)?.name,
        days: x.daysWorked, rate: x.basicRate, gross: x.grossEarnings, epf: x.epfDeduction, esi: x.esiDeduction, net: x.netEarnings,
      };
    }),
  };
}
