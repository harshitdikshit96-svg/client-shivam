// Read side for the screens: one firm with everything linked — firm → work orders → engagements → workmen →
// monthly sheets → wage lines, plus bills. Values are keyed by the column ids in lib/schema.js.
// List screens get list columns only; full records (Aadhaar, bank details) are fetched by the edit screens.
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  firms, workOrders, workOrderConfig, workOrderRates, workmen, engagements, monthlySheets, wageLines, dispatchRegister,
} from "../db/schema.js";

const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const firstDay = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
const num = (v) => (v == null ? null : Number(v));
const fullName = (p) => (p ? [p.name, p.surname].filter(Boolean).join(" ") : "");
const iso = (t) => (t ? new Date(t).toISOString() : null);

export async function firmSnapshot(db, firmId) {
  const allFirms = await db.select({ id: firms.id, name: firms.name, cuin: firms.cuin }).from(firms).orderBy(asc(firms.name));
  const firm = allFirms.find((f) => f.id === firmId) ?? allFirms[0] ?? null;
  const empty = { firms: allFirms, firm, workOrders: [], workmen: [], engagements: [], sheets: [], bills: [], activity: [] };
  if (!firm) return empty;

  const orders = await db.select().from(workOrders).where(eq(workOrders.firmId, firm.id)).orderBy(asc(workOrders.woNumber));
  const orderIds = orders.map((o) => o.id);
  const configs = orderIds.length ? await db.select().from(workOrderConfig).where(inArray(workOrderConfig.workOrderId, orderIds)) : [];
  const rates = orderIds.length ? await db.select().from(workOrderRates).where(inArray(workOrderRates.workOrderId, orderIds)) : [];
  const people = await db.select().from(workmen).where(eq(workmen.firmId, firm.id)).orderBy(asc(workmen.wuin));
  const engs = await db.select().from(engagements).where(eq(engagements.firmId, firm.id)).orderBy(asc(engagements.engagedFrom));
  const sheets = orderIds.length
    ? await db.select().from(monthlySheets).where(inArray(monthlySheets.workOrderId, orderIds)).orderBy(desc(monthlySheets.year), desc(monthlySheets.month))
    : [];
  const lines = sheets.length ? await db.select().from(wageLines).where(inArray(wageLines.sheetId, sheets.map((s) => s.id))) : [];
  const bills = await db.select().from(dispatchRegister).where(eq(dispatchRegister.firmId, firm.id)).orderBy(desc(dispatchRegister.billDate));

  const orderById = new Map(orders.map((o) => [o.id, o]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const sheetById = new Map(sheets.map((s) => [s.id, s]));

  // Last Attendance Date: the last day of the latest paid month, but no later than the engagement on that order ran
  const lastAtt = new Map();
  for (const l of lines) {
    const s = sheetById.get(l.sheetId);
    const end = lastDay(s.year, s.month);
    const start = `${String(s.year)}-${String(s.month).padStart(2, "0")}-01`;
    const ends = engs.filter((e) => e.workmanId === l.workmanId && e.workOrderId === s.workOrderId && e.engagedFrom <= end && (!e.engagedTo || e.engagedTo >= start))
      .map((e) => (!e.engagedTo || e.engagedTo > end ? end : e.engagedTo));
    const d = ends.length ? ends.sort().at(-1) : end;
    if (!lastAtt.has(l.workmanId) || lastAtt.get(l.workmanId) < d) lastAtt.set(l.workmanId, d);
  }

  const engagementRows = engs.map((e) => {
    const o = orderById.get(e.workOrderId);
    const p = personById.get(e.workmanId);
    return {
      id: e.id, workmanId: e.workmanId, workOrderId: e.workOrderId, from: e.engagedFrom, to: e.engagedTo,
      woNo: o?.woNumber, workName: o?.nameOfWork, wuin: p?.wuin, name: fullName(p), skill: p?.skillCategory, designation: p?.designation,
      status: e.engagedTo ? "Ended" : "Current",
    };
  });

  const workOrderRows = orders.map((o) => {
    const cfg = configs.find((c) => c.workOrderId === o.id);
    const myRates = rates.filter((r) => r.workOrderId === o.id);
    const current = engagementRows.filter((e) => e.workOrderId === o.id && !e.to);
    return {
      id: o.id, workOrderId: o.id, status: o.status, woNo: o.woNumber, workName: o.nameOfWork, state: o.state, district: o.district,
      nature: o.natureOfWork, start: o.commencementDate, end: o.completionDate, engineer: o.engineerInCharge ?? o.supervisorName,
      company: o.company, peName: o.principalEmployerName, peDesig: o.principalEmployerDesignation, peAddr: o.principalEmployerAddress,
      peContact: o.principalEmployerContact, partyGst: o.partyGst, areaOp: o.areaOfOperation, remarks: o.remarks,
      svName: o.supervisorName, svPhone: o.supervisorPhone,
      workmenCount: current.length, firm: firm.name,
      // what the Wage Entry grid needs to calculate live in the browser (the server recalculates on Save)
      config: cfg ? {
        statutory: { epfPercent: num(cfg.epfPercent), epfWageCeiling: num(cfg.epfWageCeiling), esiPercent: num(cfg.esiPercent), esiGrossCeiling: num(cfg.esiGrossCeiling) },
        otMultiplier: num(cfg.otMultiplier), hoursPerDay: cfg.hoursPerDay, deadlineDay: cfg.deadlineDay,
        rates: Object.fromEntries(myRates.map((r) => [r.skillCategory, { basicDaily: num(r.basicDaily), vdaDaily: num(r.vdaDaily) }])),
      } : null,
      updatedAt: iso(o.updatedAt),
    };
  });

  const workmanRows = people.map((p) => {
    const mine = engagementRows.filter((e) => e.workmanId === p.id);
    const open = mine.find((e) => !e.to);
    const shown = open ?? mine.at(-1);
    return {
      id: p.id, workmanId: p.id, wuin: p.wuin, uid: p.id, name: p.name, surname: p.surname, fullName: fullName(p),
      dob: p.dateOfBirth, gender: p.gender, skill: p.skillCategory, category: p.skillCategory, designation: p.designation,
      doj: p.dateOfJoining, mobile: p.mobile, accommodation: p.accommodation, exitDate: p.dateOfExit,
      engagedIn: shown?.woNo ?? null, engagedWoId: shown?.workOrderId ?? null, engagedFrom: shown?.from ?? null, engFrom: shown?.from ?? null,
      currentWoId: open?.workOrderId ?? null,
      lastAtt: lastAtt.get(p.id) ?? null, from: mine[0]?.from ?? p.dateOfJoining, to: p.dateOfExit ?? mine.at(-1)?.to ?? null,
      state: p.dateOfExit ? "moved" : open ? "active" : "inactive",
      status: p.dateOfExit ? "Moved out" : open ? "Active" : "Inactive",
    };
  });

  const sheetRows = sheets.map((s) => {
    const o = orderById.get(s.workOrderId);
    const mine = lines.filter((l) => l.sheetId === s.id);
    const sum = (k) => mine.reduce((t, l) => t + Number(l[k]), 0);
    return {
      id: s.id, sheetId: s.id, workOrderId: s.workOrderId, year: s.year, month: s.month, status: s.status, deadline: s.deadline,
      submittedAt: iso(s.submittedAt), approvedAt: iso(s.approvedAt),
      woNo: o.woNumber, workName: o.nameOfWork, nature: o.natureOfWork, start: o.commencementDate, end: o.completionDate,
      workmenCount: mine.length, gross: sum("grossEarnings"), totalDed: sum("totalDeduction"), net: sum("netEarnings"),
      lines: mine.map((l) => {
        const p = personById.get(l.workmanId);
        return {
          id: l.id, workmanId: l.workmanId, wuin: p?.wuin, name: fullName(p), skill: l.skillCategory,
          attDays: num(l.daysWorked), otHrs: l.otHours, otMin: l.otMinutes,
          basic: num(l.basicRate), vda: num(l.vdaRate), basicPay: num(l.basicVdaEarned), ot: num(l.otAmount),
          ug: num(l.ugAllowance), bonus: num(l.bonus), edlis: num(l.edlis), pli: num(l.pli), otherEarn: num(l.otherEarnings),
          gross: num(l.grossEarnings), epf: num(l.epfDeduction), esi: num(l.esiDeduction),
          otherDed: num(l.otherDeduction), damage: num(l.damageRecovery), totalDed: num(l.totalDeduction), net: num(l.netEarnings),
          epfPercent: num(l.epfPercent), esiPercent: num(l.esiPercent),
        };
      }).sort((a, b) => String(a.wuin).localeCompare(String(b.wuin))),
    };
  });

  const billRows = bills.map((b) => ({
    id: b.id, billId: b.id, workOrderId: b.workOrderId, woNo: orderById.get(b.workOrderId)?.woNumber ?? null,
    partyName: b.partyNameContract, billNo: b.billNumber, billDate: b.billDate,
    taxable: num(b.taxableAmount), gst: num(b.gstAmount), received: num(b.receivedAmount), receivedDate: b.receivedDate,
    deduction: num(b.deduction), remark: b.remark, gstStatus: b.gstPaymentStatus, epfStatus: b.epfPaymentStatus,
    esicStatus: b.esicPaymentStatus, approved: b.approved ? "Yes" : "No", approvedBy: b.approvedBy, approvalDate: b.approvalDate,
  }));

  // Recent Work Order Activities (home): latest changes across orders, wage months and bills
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const activity = [
    ...orders.map((o) => ({ at: iso(o.updatedAt), text: `Work order ${o.woNumber} — ${o.status}`, to: "wo_view", params: { wo: o.id } })),
    ...sheets.filter((s) => s.submittedAt).map((s) => ({
      at: iso(s.approvedAt ?? s.submittedAt), text: `Wages ${MONTH[s.month - 1]} ${s.year}, ${orderById.get(s.workOrderId).woNumber} — ${s.status}`,
      to: "wage_entry", params: { wo: s.workOrderId, y: s.year, m: s.month },
    })),
    ...bills.map((b) => ({ at: iso(b.updatedAt), text: `Bill ${b.billNumber} — ${b.approved ? "approved" : "entered"}`, to: "dispatch_register", params: { bill: b.id } })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);

  return { firms: allFirms, firm, workOrders: workOrderRows, workmen: workmanRows, engagements: engagementRows, sheets: sheetRows, bills: billRows, activity };
}

