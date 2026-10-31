// Everything the screens can do to the data. Every operation is scoped to one firm (the firm chosen in the top bar)
// and throws UserError with a plain-language message, per-field errors and, where there is one, the screen that
// fixes the problem ({ label, to, params }). The API route turns UserError into a 400 the UI can show as is.
//
// Form values arrive keyed by the field ids in lib/schema.js ("form.woNo", "details.aadhaar", …). The *_FIELDS
// tables below only say which database column each field goes to; whether it is required and what format it must
// have come from the field itself in lib/schema.js (req, format → lib/validate.js), exactly as on the screen.
import bcrypt from "bcryptjs";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  appUsers, firms, workOrders, workOrderConfig, workOrderRates, workmen, engagements, monthlySheets, wageLines, dispatchRegister,
} from "../db/schema.js";
import { SKILL_CATEGORIES, WAGE_DEFAULTS, fieldOf } from "./schema.js";
import { checkValue, sanitize } from "./validate.js";
import { PayrollError, saveWageLine, recalculateSheet } from "./payroll.js";
import { RULES, isLockedAfterCreate } from "./rules.js";
import { billTotals } from "./bill.js";

export class UserError extends Error {
  constructor(message, { fields, fix } = {}) {
    super(message);
    this.fields = fields;   // { "form.woNo": "Required" }
    this.fix = fix;         // { label, to, params } — the screen that sorts the problem out
  }
}

// ---------- field maps: [block, item, column, conversion?] (screen = where the field is defined) ----------
const FIRM_FIELDS = { screen: "create_firm", fields: [
  ["form", "name", "name"], ["form", "cuin", "cuin"], ["form", "regNo", "registrationNo"], ["form", "gstin", "gstin"], ["form", "pan", "pan"],
  ["form", "pfReg", "pfRegistrationNo"], ["form", "esic", "esicNo"], ["form", "mobile", "mobile"], ["form", "email", "email"],
  ["form", "state", "state"], ["form", "address", "address"], ["form", "pincode", "pincode"],
] };

const WO_NEW_FIELDS = { screen: "wo_new", fields: [
  ["form", "woNo", "woNumber"], ["form", "partyGst", "partyGst"], ["form", "workName", "nameOfWork"], ["form", "peName", "principalEmployerName"],
  ["form", "start", "commencementDate"], ["form", "peDesig", "principalEmployerDesignation"], ["form", "end", "completionDate"],
  ["form", "peAddr", "principalEmployerAddress"], ["form", "company", "company"], ["form", "peContact", "principalEmployerContact"],
  ["form", "state", "state"], ["form", "district", "district"], ["form", "remarks", "remarks"],
  ["form", "nature", "natureOfWork"], ["form", "areaOp", "areaOfOperation"], ["form", "svName", "supervisorName"], ["form", "svPhone", "supervisorPhone"],
] };

// Edit Work Order: every field of the order can be corrected here (CR-3), plus supervisor / nature / area
const WO_EDIT_FIELDS = { screen: "wo_edit", fields: [
  ["form", "woNo", "woNumber"], ["form", "partyGst", "partyGst"], ["form", "workName", "nameOfWork"], ["form", "company", "company"],
  ["form", "start", "commencementDate"], ["form", "end", "completionDate"], ["form", "peContact", "principalEmployerContact"],
  ["form", "peName", "principalEmployerName"], ["form", "svName", "supervisorName"], ["form", "peDesig", "principalEmployerDesignation"],
  ["form", "svPhone", "supervisorPhone"], ["form", "peAddr", "principalEmployerAddress"], ["form", "svPhone2", "supervisorPhoneAlt"],
  ["form", "state", "state"], ["form", "svEmail", "supervisorEmail"], ["form", "district", "district"], ["form", "svEmail2", "supervisorEmailAlt"],
  ["form", "nature", "natureOfWork"], ["form", "areaOp", "areaOfOperation"], ["form", "remarks", "remarks"],
] };

const CONFIG_FIELDS = { screen: "wo_config", fields: [
  ["statutory", "epfPercent", "epfPercent"], ["statutory", "epfWageCeiling", "epfWageCeiling"], ["statutory", "esiPercent", "esiPercent"],
  ["statutory", "esiGrossCeiling", "esiGrossCeiling"], ["statutory", "otMultiplier", "otMultiplier", null, { min: 1, max: 10 }],
  ["statutory", "hoursPerDay", "hoursPerDay", "int", { min: 1, max: 24 }], ["statutory", "deadlineDay", "deadlineDay", "int", { min: 1, max: 31 }],
] };

const WORKMAN_FIELDS = { screen: "wm_edit", fields: [
  ["details", "wuin", "wuin", null, { keepIfBlank: true }], ["details", "aadhaar", "aadhaar", null, { req: () => RULES.aadhaarRequired }],
  ["details", "name", "name"], ["details", "surname", "surname"], ["details", "gender", "gender"], ["details", "relative", "relativeName"],
  ["details", "dob", "dateOfBirth"], ["details", "nationality", "nationality"], ["details", "education", "educationLevel"],
  ["details", "doj", "dateOfJoining"], ["details", "designation", "designation"], ["details", "skill", "skillCategory"],
  ["details", "empType", "employmentType"], ["details", "mobile", "mobile"], ["details", "pfType", "pfType"], ["details", "uan", "uanOrCmpfNo"],
  ["details", "gis", "groupInsuranceNo"], ["details", "pan", "pan"], ["details", "esic", "esicIp"], ["details", "bankAc", "bankAccountNo"],
  ["details", "bank", "bankName"], ["details", "ifsc", "ifsc"], ["details", "presentAddr", "address"], ["details", "exitDate", "dateOfExit"],
  ["details", "idMark", "identificationMark"], ["details", "pwd", "isDisabled", "yesno"], ["details", "disability", "disabilityDetails"],
  ["details", "religion", "religion"], ["details", "exServ", "isExServiceman", "yesno"], ["details", "accommodation", "accommodation"],
  ["details", "wageCat", "wageCategory"],
  ["nominee", "name", "nomineeName"], ["nominee", "relation", "nomineeRelationship"], ["nominee", "dob", "nomineeDob"], ["nominee", "aadhaar", "nomineeAadhaar"],
  ["emergency", "nameRel", "emergencyContactName"], ["emergency", "address", "emergencyContactAddress"], ["emergency", "phone", "emergencyContactPhone"],
] };

const BILL_FIELDS = { screen: "dispatch_register", fields: [
  ["details", "wo", "workOrderId", "id"], ["details", "partyName", "partyNameContract"], ["details", "billNo", "billNumber"],
  ["details", "billDate", "billDate"], ["details", "taxable", "taxableAmount"], ["details", "taxRate", "taxRate"], ["details", "gstRate", "gstRate"],
  ["details", "received", "receivedAmount"], ["details", "receivedDate", "receivedDate"], ["details", "deduction", "deduction"],
  ["details", "remark", "remark"], ["details", "gstStatus", "gstPaymentStatus"], ["details", "epfStatus", "epfPaymentStatus"],
  ["details", "esicStatus", "esicPaymentStatus"], ["details", "approved", "approved", "yesno"], ["details", "approvedBy", "approvedBy"],
  ["details", "approvalDate", "approvalDate"],
] };

const blank = (v) => v == null || String(v).trim() === "";
const NUMERIC = new Set(["money", "positiveMoney", "percent", "decimal", "int"]);

/**
 * Form values → column values, with per-field errors. mode "create" | "update".
 * Each field is checked against its definition in lib/schema.js: required, one of the options, format and length.
 * lib/rules.js can lock chosen fields once a record exists (none by default).
 */
function readForm(map, values, mode = "create") {
  const out = {};
  const errors = {};
  for (const [block, item, col, conv, opt = {}] of map.fields) {
    if (mode !== "create" && isLockedAfterCreate(map.screen, block, item)) continue;
    const def = fieldOf(map.screen, block, item) ?? {};
    const key = `${block}.${item}`;
    let v = values?.[block]?.[item];
    if (typeof v === "string") v = v.trim();
    if (def.format && typeof v === "string" && !NUMERIC.has(def.format)) v = sanitize(def.format, v, { cut: false });
    if (blank(v)) {
      if (opt.keepIfBlank) continue;
      const req = opt.req ? opt.req() : def.req;
      if (req) errors[key] = "Required";
      out[col] = conv === "yesno" ? false : null;
      continue;
    }
    if (def.input === "select" && def.options?.length && !def.options.includes(v)) { errors[key] = "Choose one of the options in the list"; continue; }
    const bad = def.format ? checkValue(def.format, v, { max: def.maxLength, min: opt.min }) ?? (opt.max != null && Number(v) > opt.max ? `Should be at most ${opt.max}` : null) : null;
    if (bad) { errors[key] = bad; continue; }
    if (conv === "yesno") { out[col] = v === true || v === "Yes"; continue; }
    if (conv === "id") { out[col] = Number(v) || null; continue; }
    if (conv === "int") { out[col] = Number(v); continue; }
    out[col] = NUMERIC.has(def.format) ? String(Number(v)) : v;
  }
  return { row: out, errors };
}

/** Column values → form values (for edit screens). */
function toForm(map, row) {
  const out = {};
  for (const [block, item, col, conv] of map.fields) {
    out[block] ??= {};
    const v = row?.[col];
    out[block][item] = v == null ? "" : conv === "yesno" ? (v ? "Yes" : "No") : String(v);
  }
  return out;
}

const failIf = (errors, extra = {}) => {
  const all = { ...errors, ...extra };
  if (Object.keys(all).length) throw new UserError("Please correct the highlighted fields.", { fields: all });
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- guards ----------
async function firmOf(db, firmId) {
  if (!firmId) throw new UserError("No firm is selected. Create a firm first; everything else is kept under a firm.", { fix: { label: "Create Firm", to: "create_firm" } });
  const [f] = await db.select().from(firms).where(eq(firms.id, firmId));
  if (!f) throw new UserError("The selected firm no longer exists. Pick another firm in the top bar.");
  return f;
}

async function orderOf(db, firmId, workOrderId) {
  await firmOf(db, firmId);
  const [wo] = await db.select().from(workOrders).where(and(eq(workOrders.id, Number(workOrderId)), eq(workOrders.firmId, firmId)));
  if (!wo) throw new UserError("Select a work order of this firm first.", { fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } });
  return wo;
}

const NOT_APPROVED = {
  pending: (wo) => new UserError(`Work order ${wo.woNumber} is still waiting for approval. Approve it first.`, { fix: { label: "Pending Work Order Approval", to: "wo_pending" } }),
  rejected: (wo) => new UserError(`Work order ${wo.woNumber} was rejected. Resubmit it for approval first.`, { fix: { label: "Pending Work Order Approval", to: "wo_pending" } }),
  completed: (wo) => new UserError(`Work order ${wo.woNumber} is completed; no new workmen can be engaged on it.`, { fix: { label: "Ongoing Work Orders", to: "wo_ongoing" } }),
};
const requireApproved = (wo, allow = ["approved"]) => {
  if (!allow.includes(wo.status)) throw NOT_APPROVED[wo.status](wo);
};

async function workmanOf(db, firmId, workmanId) {
  const [w] = await db.select().from(workmen).where(and(eq(workmen.id, Number(workmanId)), eq(workmen.firmId, firmId)));
  if (!w) throw new UserError("This workman is not in the selected firm.");
  return w;
}

const dayBefore = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const firstDay = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
const today = () => new Date().toISOString().slice(0, 10);

// ---------- firms ----------
export async function createFirm(db, { values }) {
  const { row, errors } = readForm(FIRM_FIELDS, values);
  failIf(errors);
  const [f] = await db.insert(firms).values(row).returning();
  return f;
}

export async function updateFirm(db, { firmId, values }) {
  await firmOf(db, firmId);
  const { row, errors } = readForm(FIRM_FIELDS, values);
  failIf(errors);
  const [f] = await db.update(firms).set({ ...row, updatedAt: new Date() }).where(eq(firms.id, firmId)).returning();
  return f;
}

export async function getFirm(db, { firmId }) {
  return toForm(FIRM_FIELDS, await firmOf(db, firmId));
}

// ---------- work orders ----------
function readConfig(values) {
  const { row, errors } = readForm(CONFIG_FIELDS, values);
  const rates = [];
  for (const skill of SKILL_CATEGORIES) {
    const r = values?.rates?.[skill] ?? {};
    if (blank(r.basicDaily)) {
      if (!blank(r.vdaDaily) && Number(r.vdaDaily) > 0) errors[`rates.${skill}`] = "Enter the Per Day Wage too, or clear the VDA";
      continue;
    }
    const badBasic = checkValue("positiveMoney", String(r.basicDaily).trim());
    const badVda = checkValue("money", blank(r.vdaDaily) ? "" : String(r.vdaDaily).trim());
    if (badBasic) { errors[`rates.${skill}`] = `Per Day Wage: ${badBasic.replace(/^Should be /, "should be ")}`; continue; }
    if (badVda) { errors[`rates.${skill}`] = `VDA: ${badVda.replace(/^Should be /, "should be ")}`; continue; }
    const basic = Number(r.basicDaily);
    const vda = blank(r.vdaDaily) ? 0 : Number(r.vdaDaily);
    rates.push({ skillCategory: skill, basicDaily: String(basic), vdaDaily: String(vda) });
  }
  if (!rates.length && !Object.keys(errors).some((k) => k.startsWith("rates."))) {
    errors["rates.Unskilled"] = "Enter the Per Day Wage for at least one skill category";
  }
  return { config: row, rates, errors };
}

async function writeConfig(db, workOrderId, config, rates) {
  await db.insert(workOrderConfig).values({ workOrderId, ...config })
    .onConflictDoUpdate({ target: workOrderConfig.workOrderId, set: { ...config, updatedAt: new Date() } });
  await db.delete(workOrderRates).where(eq(workOrderRates.workOrderId, workOrderId));
  if (rates.length) await db.insert(workOrderRates).values(rates.map((r) => ({ workOrderId, ...r })));
}

export async function createWorkOrder(db, { firmId, values }) {
  await firmOf(db, firmId);
  const { row, errors } = readForm(WO_NEW_FIELDS, values);
  const cfg = readConfig(values);
  const extra = {};
  if (row.commencementDate && row.completionDate && row.completionDate < row.commencementDate) extra["form.end"] = "Should be on or after the Date of Commencement";
  failIf({ ...errors, ...cfg.errors }, extra);
  const [wo] = await db.insert(workOrders).values({ ...row, firmId, status: "pending" }).returning();
  await writeConfig(db, wo.id, cfg.config, cfg.rates);
  return wo;
}

export async function updateWorkOrder(db, { firmId, workOrderId, values }) {
  const wo = await orderOf(db, firmId, workOrderId);
  const { row, errors } = readForm(WO_EDIT_FIELDS, values, "update");
  const cfg = readConfig(values);
  const extra = {};
  if (row.commencementDate && row.completionDate && row.completionDate < row.commencementDate) extra["form.end"] = "Should be on or after the Date of Commencement";
  failIf({ ...errors, ...cfg.errors }, extra);
  await orderDatesProblem(db, wo, row.commencementDate ?? wo.commencementDate, row.completionDate ?? wo.completionDate);
  const [saved] = await db.update(workOrders).set({ ...row, updatedAt: new Date() }).where(eq(workOrders.id, wo.id)).returning();
  const recalculated = await saveConfigRows(db, wo.id, cfg);
  return { ...saved, recalculated };
}

/** New order dates must still hold its engagements and its wage months (names what falls outside). */
async function orderDatesProblem(db, wo, start, end) {
  const outside = [];
  if (RULES.engagementWithinOrderDates) {
    const engs = await db.select({ from: engagements.engagedFrom, to: engagements.engagedTo, wuin: workmen.wuin })
      .from(engagements).innerJoin(workmen, eq(workmen.id, engagements.workmanId)).where(eq(engagements.workOrderId, wo.id));
    for (const e of engs) {
      if (e.from < start || e.from > end || (e.to && e.to > end)) outside.push(`${e.wuin}'s engagement ${show(e.from)} to ${show(e.to)}`);
    }
  }
  const sheets = await db.select().from(monthlySheets).where(eq(monthlySheets.workOrderId, wo.id));
  for (const sh of sheets) if (lastDay(sh.year, sh.month) < start || firstDay(sh.year, sh.month) > end) outside.push(`the wages of ${monthName(sh.year, sh.month)}`);
  if (outside.length) {
    const list = outside.slice(0, 3).join(", ") + (outside.length > 3 ? ` and ${outside.length - 3} more` : "");
    throw new UserError(`The new dates (${span(start, end)}) would leave ${list} outside the work order. Change those first, or keep wider dates.`, {
      fields: { "form.start": "Would leave records outside the order", "form.end": "Would leave records outside the order" },
    });
  }
}

async function saveConfigRows(db, workOrderId, cfg) {
  await writeConfig(db, workOrderId, cfg.config, cfg.rates);
  // draft months follow the new Config; submitted months keep theirs
  const drafts = await db.select().from(monthlySheets).where(and(eq(monthlySheets.workOrderId, workOrderId), eq(monthlySheets.status, "draft")));
  let n = 0;
  for (const s of drafts) {
    try { n += (await recalculateSheet(db, s.id)).length; } catch (e) {
      if (!(e instanceof PayrollError)) throw e;
      throw new UserError(`Config saved, but the draft month ${s.month}/${s.year} could not be recalculated: ${e.message}.`);
    }
  }
  return n;
}

export async function saveConfig(db, { firmId, workOrderId, values }) {
  const wo = await orderOf(db, firmId, workOrderId);
  const cfg = readConfig(values);
  failIf(cfg.errors);
  return { workOrderId: wo.id, recalculated: await saveConfigRows(db, wo.id, cfg) };
}

export async function getWorkOrder(db, { firmId, workOrderId }) {
  const wo = await orderOf(db, firmId, workOrderId);
  const [cfg] = await db.select().from(workOrderConfig).where(eq(workOrderConfig.workOrderId, wo.id));
  const rates = await db.select().from(workOrderRates).where(eq(workOrderRates.workOrderId, wo.id));
  const values = { ...toForm(WO_EDIT_FIELDS, wo), ...toForm(CONFIG_FIELDS, cfg ?? WAGE_DEFAULTS) };
  values.rates = Object.fromEntries(rates.map((r) => [r.skillCategory, { basicDaily: String(Number(r.basicDaily)), vdaDaily: Number(r.vdaDaily) ? String(Number(r.vdaDaily)) : "" }]));
  return values;
}

const STATUS_MOVES = {
  approve: { from: ["pending"], to: "approved", verb: "approved" },
  reject: { from: ["pending"], to: "rejected", verb: "rejected" },
  resubmit: { from: ["rejected"], to: "pending", verb: "sent for approval again" },
  complete: { from: ["approved"], to: "completed", verb: "marked completed" },
  reopen: { from: ["completed"], to: "approved", verb: "reopened" },
};

/** Approve / reject / resubmit / complete / reopen a work order. Completing ends its open engagements. */
export async function setWorkOrderStatus(db, { firmId, workOrderId, move }) {
  const wo = await orderOf(db, firmId, workOrderId);
  const m = STATUS_MOVES[move];
  if (!m) throw new UserError(`Unknown action "${move}".`);
  if (!m.from.includes(wo.status)) throw new UserError(`Work order ${wo.woNumber} is ${wo.status}; it cannot be ${m.verb}.`);
  if (move === "approve") {
    const [cfg] = await db.select().from(workOrderConfig).where(eq(workOrderConfig.workOrderId, wo.id));
    const rates = await db.select().from(workOrderRates).where(eq(workOrderRates.workOrderId, wo.id));
    if (!cfg || !rates.length) {
      throw new UserError(`Set the Per Day Wage in the Config of ${wo.woNumber} before approving it.`, { fix: { label: "Open Config", to: "wo_config", params: { wo: wo.id } } });
    }
  }
  let ended = 0;
  if (move === "complete") {
    const end = wo.completionDate < today() ? wo.completionDate : today();
    const open = await db.select().from(engagements).where(and(eq(engagements.workOrderId, wo.id), isNull(engagements.engagedTo)));
    for (const e of open) {
      const w = await workmanOf(db, firmId, e.workmanId);
      const problem = await checkEngagementChange(db, w, [{ id: e.id, wo, from: e.engagedFrom, to: e.engagedFrom > end ? e.engagedFrom : end }]);
      if (problem) throw new UserError(`${wo.woNumber} cannot be completed on ${show(end)}: ${problem}`);
    }
    for (const e of open) {
      await db.update(engagements).set({ engagedTo: e.engagedFrom > end ? e.engagedFrom : end }).where(eq(engagements.id, e.id));
      ended++;
    }
  }
  const [saved] = await db.update(workOrders).set({ status: m.to, updatedAt: new Date() }).where(eq(workOrders.id, wo.id)).returning();
  return { ...saved, verb: m.verb, ended };
}

// ---------- workmen ----------
async function nextWuin(db, firmId) {
  const rows = await db.select({ wuin: workmen.wuin }).from(workmen).where(eq(workmen.firmId, firmId));
  const max = rows.reduce((m, r) => Math.max(m, Number(/^WM(\d+)$/.exec(r.wuin)?.[1] ?? 0)), 0);
  return `WM${String(max + 1).padStart(5, "0")}`;
}

const yearsBetween = (a, b) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
};

function workmanChecks(row) {
  const e = {};
  if (row.dateOfBirth && row.dateOfBirth >= today()) e["details.dob"] = "Should be in the past";
  else if (row.dateOfBirth && row.dateOfJoining && RULES.minimumAge && yearsBetween(row.dateOfBirth, row.dateOfJoining) < RULES.minimumAge) {
    e["details.doj"] = `The workman would be under ${RULES.minimumAge} on the date of joining`;
  }
  if (row.dateOfBirth && row.dateOfJoining && row.dateOfJoining <= row.dateOfBirth) e["details.doj"] = "Should be after the Date of Birth";
  if (row.nomineeDob && row.nomineeDob > today()) e["nominee.dob"] = "Should not be in the future";
  if (row.dateOfExit && row.dateOfJoining && row.dateOfExit < row.dateOfJoining) e["details.exitDate"] = "Should be on or after the Date of Joining";
  if (row.isDisabled && blank(row.disabilityDetails)) e["details.disability"] = "Describe the disability";
  return e;
}

/** RULES.aadhaarUniquePerFirm: the same Aadhaar on two workmen of a firm is refused, naming the other WUIN. */
async function aadhaarFree(db, firmId, aadhaar, exceptId = null) {
  if (!RULES.aadhaarUniquePerFirm || !aadhaar) return;
  const rows = await db.select({ id: workmen.id, wuin: workmen.wuin }).from(workmen).where(and(eq(workmen.firmId, firmId), eq(workmen.aadhaar, aadhaar)));
  const dup = rows.find((r) => r.id !== exceptId);
  if (dup) throw new UserError(`This Aadhaar is already registered in this firm (WUIN ${dup.wuin}).`, { fields: { "details.aadhaar": `Already registered as ${dup.wuin}` } });
}

export async function createWorkman(db, { firmId, values }) {
  await firmOf(db, firmId);
  const { row, errors } = readForm(WORKMAN_FIELDS, values, "create");
  failIf(errors, workmanChecks(row));
  await aadhaarFree(db, firmId, row.aadhaar);
  // aadhaar column is NOT NULL: when the rules allow saving without one, it is stored empty
  const [w] = await db.insert(workmen).values({ ...row, aadhaar: row.aadhaar ?? "", firmId, wuin: row.wuin || await nextWuin(db, firmId) }).returning();
  return w;
}

export async function updateWorkman(db, { firmId, workmanId, values }) {
  const before = await workmanOf(db, firmId, workmanId);
  const { row, errors } = readForm(WORKMAN_FIELDS, values, "update");
  failIf(errors, workmanChecks({ ...before, ...row }));
  if ("aadhaar" in row) { await aadhaarFree(db, firmId, row.aadhaar, before.id); row.aadhaar ??= ""; }
  // joining after an engagement already started would break the engagement rule
  const engs = await engagementsOf(db, before.id);
  if (RULES.engagementAfterJoining && row.dateOfJoining) {
    const early = engs.find((e) => e.from < row.dateOfJoining);
    if (early) failIf({ "details.doj": `Should be on or before ${show(early.from)}, when the engagement on ${early.woNo} started` });
  }
  // a date of exit closes the open engagement on that day: the workman moves to "Workmen Moved Out"
  if (row.dateOfExit) {
    const after = engs.find((e) => e.from > row.dateOfExit);
    if (after) failIf({ "details.exitDate": `Should be on or after ${show(after.from)}, when the engagement on ${after.woNo} started` });
    const [open] = await db.select().from(engagements).where(and(eq(engagements.workmanId, before.id), isNull(engagements.engagedTo)));
    if (open) {
      const [openWo] = await db.select().from(workOrders).where(eq(workOrders.id, open.workOrderId));
      const problem = await checkEngagementChange(db, { ...before, dateOfExit: null }, [{ id: open.id, wo: openWo, from: open.engagedFrom, to: row.dateOfExit }]);
      if (problem) failIf({ "details.exitDate": problem });
      await db.update(engagements).set({ engagedTo: row.dateOfExit }).where(eq(engagements.id, open.id));
    }
  }
  const [w] = await db.update(workmen).set({ ...row, updatedAt: new Date() }).where(eq(workmen.id, before.id)).returning();
  return w;
}

export async function getWorkman(db, { firmId, workmanId }) {
  const w = await workmanOf(db, firmId, workmanId);
  return { wuin: w.wuin, values: toForm(WORKMAN_FIELDS, w) };
}

/** Bulk Accommodation: set the Accommodation field for many workmen at once. */
export async function setAccommodation(db, { firmId, workmanIds, accommodation }) {
  await firmOf(db, firmId);
  if (!["Self", "Company Quarter", "Contractors' camp"].includes(accommodation)) throw new UserError("Choose the accommodation to set.", { fields: { "bulk.accommodation": "Required" } });
  const ids = (workmanIds ?? []).map(Number).filter(Boolean);
  if (!ids.length) throw new UserError("Tick at least one workman.");
  const rows = await db.update(workmen).set({ accommodation, updatedAt: new Date() })
    .where(and(eq(workmen.firmId, firmId), inArray(workmen.id, ids))).returning({ id: workmen.id });
  return { updated: rows.length };
}

// ---------- integrity: one work order per workman per day; wages stay inside engagements ----------
const OPEN_END = "9999-12-31";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (y, m) => `${MONTH_NAMES[m - 1]} ${y}`;
const show = (d) => (d ? d.split("-").reverse().join("/") : "now");
const span = (from, to) => `${show(from)} to ${show(to)}`;
const daysInMonth = (y, m) => Number(lastDay(y, m).slice(8));
const overlap = (a1, a2, b1, b2) => a1 <= (b2 ?? OPEN_END) && b1 <= (a2 ?? OPEN_END);
const dayNo = (d) => Date.parse(`${d}T00:00:00Z`) / 86400000;
/** Days of month (y, m) that fall inside [from, to]. */
function daysCovered(from, to, y, m) {
  const a = from > firstDay(y, m) ? from : firstDay(y, m);
  const b = (to ?? OPEN_END) < lastDay(y, m) ? to : lastDay(y, m);
  return a > b ? 0 : dayNo(b) - dayNo(a) + 1;
}

/** Every engagement of a workman, with its work order number. */
async function engagementsOf(db, workmanId) {
  return db.select({ id: engagements.id, workOrderId: engagements.workOrderId, from: engagements.engagedFrom, to: engagements.engagedTo, woNo: workOrders.woNumber })
    .from(engagements).innerJoin(workOrders, eq(workOrders.id, engagements.workOrderId))
    .where(eq(engagements.workmanId, workmanId)).orderBy(asc(engagements.engagedFrom));
}

/** Months a workman has wages on, with days and the order: [{ workOrderId, woNo, year, month, days, sheetId, status }] */
async function paidMonthsOf(db, workmanId) {
  const rows = await db.select({
    workOrderId: monthlySheets.workOrderId, woNo: workOrders.woNumber, year: monthlySheets.year, month: monthlySheets.month,
    days: wageLines.daysWorked, sheetId: monthlySheets.id, status: monthlySheets.status,
  }).from(wageLines).innerJoin(monthlySheets, eq(monthlySheets.id, wageLines.sheetId)).innerJoin(workOrders, eq(workOrders.id, monthlySheets.workOrderId))
    .where(eq(wageLines.workmanId, workmanId));
  return rows.map((r) => ({ ...r, days: Number(r.days) }));
}

/**
 * Would this engagement period break a rule? `others` = the workman's other engagements as they will be after the
 * change (so a move can pass the shortened one). Returns the message, or null.
 */
function periodProblem({ w, wo, from, to, others }) {
  if (!from || !DATE.test(from)) return `${w.wuin}: enter the Engaged From date`;
  if (to && !DATE.test(to)) return `${w.wuin}: the Engaged To date is not a date`;
  if (to && to < from) return `${w.wuin}: Engaged To should be on or after Engaged From (${show(from)})`;
  if (RULES.engagementAfterJoining && from < w.dateOfJoining) return `${w.wuin} joined on ${show(w.dateOfJoining)} (Date of Joining), so the engagement can start on that date or later. Pick a later date, or correct the Date of Joining on the workman's page`;
  if (w.dateOfExit && from > w.dateOfExit) return `${w.wuin} left on ${show(w.dateOfExit)} (date of exit)`;
  if (RULES.engagementWithinOrderDates) {
    if (from < wo.commencementDate || from > wo.completionDate) return `${w.wuin}: should start within the work order dates (${span(wo.commencementDate, wo.completionDate)})`;
    if (to && to > wo.completionDate) return `${w.wuin}: should end by the work order's completion date (${show(wo.completionDate)})`;
  }
  const clash = others.find((e) => overlap(from, to, e.from, e.to));
  if (clash) {
    return `${w.wuin} is on ${clash.woNo} from ${span(clash.from, clash.to)}; a workman can be on only one work order on any day`;
  }
  return null;
}

/** After a change, every month already paid on an order must still be covered by the engagements on that order. */
function wagesProblem({ w, paid, after, workOrderIds }) {
  for (const p of paid.filter((x) => workOrderIds.includes(x.workOrderId))) {
    const covered = after.filter((e) => e.workOrderId === p.workOrderId).reduce((t, e) => t + daysCovered(e.from, e.to, p.year, p.month), 0);
    if (covered < p.days) {
      return `${w.wuin} has ${p.days} days of wages on ${p.woNo} in ${monthName(p.year, p.month)}; after this change the engagement would cover only ${covered} day${covered === 1 ? "" : "s"} of that month. Correct or delete those wages first.`;
    }
  }
  return null;
}

/** Apply a list of engagement changes for one workman after checking them all. changes: [{ id?, workOrderId, from, to, wo }] */
async function checkEngagementChange(db, w, changes, { removeIds = [] } = {}) {
  const current = await engagementsOf(db, w.id);
  const changedIds = changes.filter((c) => c.id).map((c) => c.id);
  const after = [
    ...current.filter((e) => !changedIds.includes(e.id) && !removeIds.includes(e.id)),
    ...changes.map((c) => ({ id: c.id ?? null, workOrderId: c.wo.id, woNo: c.wo.woNumber, from: c.from, to: c.to || null, change: c })),
  ];
  for (const c of changes) {
    const others = after.filter((e) => e.change !== c);   // every engagement as it will be, except this one
    const problem = periodProblem({ w, wo: c.wo, from: c.from, to: c.to || null, others });
    if (problem) return problem;
  }
  const touched = [...new Set([...changes.map((c) => c.wo.id), ...current.filter((e) => removeIds.includes(e.id) || changedIds.includes(e.id)).map((e) => e.workOrderId)])];
  return wagesProblem({ w, paid: await paidMonthsOf(db, w.id), after, workOrderIds: touched });
}

async function engagementOf(db, firmId, engagementId) {
  await firmOf(db, firmId);
  const [e] = await db.select().from(engagements).where(and(eq(engagements.id, Number(engagementId)), eq(engagements.firmId, firmId)));
  if (!e) throw new UserError("This engagement is not in the selected firm.");
  const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, e.workOrderId));
  const w = await workmanOf(db, firmId, e.workmanId);
  return { e, wo, w };
}

// ---------- engagements ----------
/** Engage workmen on a work order from a date. A workman engaged elsewhere is moved: that engagement ends the day before. */
export async function engageWorkmen(db, { firmId, workOrderId, rows }) {
  if (!workOrderId) throw new UserError("Select the work order to engage workmen on (the drop-down at the top).", { fields: { "select.wo": "Required" } });
  const wo = await orderOf(db, firmId, workOrderId);
  requireApproved(wo);
  const picked = (rows ?? []).filter((r) => r?.workmanId);
  if (!picked.length) throw new UserError("Tick the workmen to engage (Select column), then press Engage Selected.");
  const errors = {};
  const plan = [];
  const seen = new Set();
  for (const r of picked) {
    const key = `row.${r.workmanId}`;
    const w = await workmanOf(db, firmId, r.workmanId);
    if (seen.has(w.id)) { errors[key] = `${w.wuin} is listed twice`; continue; }
    seen.add(w.id);
    const from = r.from;
    if (!from || !DATE.test(from)) { errors[key] = `${w.wuin}: enter the New Engagement From date`; continue; }
    if (w.dateOfExit) { errors[key] = `${w.wuin} has moved out (date of exit ${show(w.dateOfExit)})`; continue; }
    const [open] = await db.select().from(engagements).where(and(eq(engagements.workmanId, w.id), isNull(engagements.engagedTo)));
    if (open?.workOrderId === wo.id) { errors[key] = `${w.wuin} is already engaged on ${wo.woNumber} since ${show(open.engagedFrom)}`; continue; }
    if (open && from <= open.engagedFrom) { errors[key] = `${w.wuin}: should be after ${show(open.engagedFrom)}, when the current engagement started`; continue; }
    const changes = [{ wo, from, to: null }];
    if (open) {
      const [openWo] = await db.select().from(workOrders).where(eq(workOrders.id, open.workOrderId));
      changes.push({ id: open.id, wo: openWo, from: open.engagedFrom, to: dayBefore(from) });
    }
    const problem = await checkEngagementChange(db, w, changes);
    if (problem) { errors[key] = problem; continue; }
    plan.push({ w, from, open });
  }
  failIf(errors);
  for (const { w, from, open } of plan) {
    if (open) await db.update(engagements).set({ engagedTo: dayBefore(from) }).where(eq(engagements.id, open.id));
    await db.insert(engagements).values({ firmId, workmanId: w.id, workOrderId: wo.id, engagedFrom: from });
  }
  return { engaged: plan.length, moved: plan.filter((p) => p.open).length, woNumber: wo.woNumber };
}

/** Correct an engagement's dates (from, and to — blank to = still engaged). Same rules as engaging. */
export async function editEngagement(db, { firmId, engagementId, from, to }) {
  const { e, wo, w } = await engagementOf(db, firmId, engagementId);
  const problem = await checkEngagementChange(db, w, [{ id: e.id, wo, from, to: to || null }]);
  if (problem) throw new UserError(problem + ".", { fields: { "eng.from": problem } });
  const [saved] = await db.update(engagements).set({ engagedFrom: from, engagedTo: to || null }).where(eq(engagements.id, e.id)).returning();
  return saved;
}

export async function endEngagement(db, { firmId, engagementId, to }) {
  const { e, wo, w } = await engagementOf(db, firmId, engagementId);
  if (e.engagedTo) throw new UserError(`This engagement already ended on ${show(e.engagedTo)}. Use Edit to correct the date.`);
  if (!to || !DATE.test(to)) throw new UserError("Enter the date the engagement ends.", { fields: { [`eng.${e.id}`]: "Required" } });
  if (to < e.engagedFrom) throw new UserError(`The end date should be on or after ${show(e.engagedFrom)}.`, { fields: { [`eng.${e.id}`]: `On or after ${show(e.engagedFrom)}` } });
  const problem = await checkEngagementChange(db, w, [{ id: e.id, wo, from: e.engagedFrom, to }]);
  if (problem) throw new UserError(problem);
  const [saved] = await db.update(engagements).set({ engagedTo: to }).where(eq(engagements.id, e.id)).returning();
  return saved;
}

/** Remove an engagement entered by mistake (only while no wages depend on it). */
export async function deleteEngagement(db, { firmId, engagementId }) {
  const { e, w } = await engagementOf(db, firmId, engagementId);
  const problem = await checkEngagementChange(db, w, [], { removeIds: [e.id] });
  if (problem) throw new UserError(problem);
  await db.delete(engagements).where(eq(engagements.id, e.id));
  return { deleted: e.id, wuin: w.wuin };
}

// ---------- wages ----------
/** The month's sheet for a work order, created as a draft the first time someone saves wages for it. */
async function sheetFor(db, wo, year, month) {
  const [s] = await db.select().from(monthlySheets).where(and(eq(monthlySheets.workOrderId, wo.id), eq(monthlySheets.year, year), eq(monthlySheets.month, month)));
  if (s) return s;
  const [cfg] = await db.select().from(workOrderConfig).where(eq(workOrderConfig.workOrderId, wo.id));
  let deadline = null;
  if (cfg?.deadlineDay) {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    deadline = `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(cfg.deadlineDay, Number(lastDay(ny, nm).slice(8)))).padStart(2, "0")}`;
  }
  const [created] = await db.insert(monthlySheets).values({ workOrderId: wo.id, year, month, deadline }).returning();
  return created;
}

function checkPeriod(wo, year, month) {
  year = Number(year); month = Number(month);
  if (!(year >= 2020 && year <= 2100 && month >= 1 && month <= 12)) throw new UserError("Select the year and month first.", { fields: { "select.month": "Required" } });
  if (lastDay(year, month) < wo.commencementDate || firstDay(year, month) > wo.completionDate) {
    throw new UserError(`Work order ${wo.woNumber} runs from ${span(wo.commencementDate, wo.completionDate)}; ${monthName(year, month)} is outside it.`);
  }
  return { year, month };
}

/**
 * Days that can be paid for a workman on this order in this month (RULES.wageDaysWithinEngagement):
 * no more than the month has, than the days engaged on this order, and — with other orders' wages — than the month has.
 */
async function daysProblem(db, w, wo, year, month, days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;   // the wage engine explains bad numbers
  const dim = daysInMonth(year, month);
  if (n > dim) return `${n} days entered, but ${monthName(year, month)} has ${dim} days`;
  if (!RULES.wageDaysWithinEngagement) return null;
  const mine = (await engagementsOf(db, w.id)).filter((e) => e.workOrderId === wo.id);
  const covered = mine.reduce((t, e) => t + daysCovered(e.from, e.to, year, month), 0);
  if (covered > 0 && n > covered) {
    const when = mine.filter((e) => daysCovered(e.from, e.to, year, month) > 0).map((e) => span(e.from, e.to)).join(", ");
    return `${n} days entered, but ${w.wuin}'s engagement on ${wo.woNumber} covers only ${covered} day${covered === 1 ? "" : "s"} of ${monthName(year, month)} (${when}). Enter at most ${covered}, or correct the engagement dates (Edit, on the work order's page)`;
  }
  const elsewhere = (await paidMonthsOf(db, w.id)).filter((p) => p.year === year && p.month === month && p.workOrderId !== wo.id);
  const other = elsewhere.reduce((t, p) => t + p.days, 0);
  if (other + n > dim) {
    return `${w.wuin} already has ${other} days in ${monthName(year, month)} on ${elsewhere.map((p) => p.woNo).join(", ")}; at most ${dim - other} more can be paid here`;
  }
  return null;
}

/**
 * Save the Wage Entry grid. rows: [{ workmanId, daysWorked, otHours, otMinutes, ugAllowance, … }]
 * A row with Days Worked left blank is skipped — or, if it was saved before, removed from the month.
 * Returns { sheetId, saved, removed, errors: { workmanId: message } }.
 */
export async function saveWages(db, { firmId, workOrderId, year, month, rows }) {
  const wo = await orderOf(db, firmId, workOrderId);
  requireApproved(wo, ["approved", "completed"]);
  const p = checkPeriod(wo, year, month);
  const all = rows ?? [];
  const typed = all.filter((r) => !blank(r.daysWorked));
  const [existing] = await db.select().from(monthlySheets).where(and(eq(monthlySheets.workOrderId, wo.id), eq(monthlySheets.year, p.year), eq(monthlySheets.month, p.month)));
  const savedBefore = existing ? await db.select({ workmanId: wageLines.workmanId }).from(wageLines).where(eq(wageLines.sheetId, existing.id)) : [];
  const cleared = all.filter((r) => blank(r.daysWorked) && savedBefore.some((l) => l.workmanId === Number(r.workmanId)));
  if (!typed.length && !cleared.length) throw new UserError("Type the Days Worked for at least one workman, then press Save.");
  const sheet = existing ?? await sheetFor(db, wo, p.year, p.month);
  if (sheet.status !== "draft") throw new UserError(`Wages for ${monthName(p.year, p.month)} are already ${sheet.status}; press Reopen for Editing to change them.`);
  const errors = {};
  let saved = 0;
  for (const r of typed) {
    try {
      const w = await workmanOf(db, firmId, r.workmanId);
      const tooMany = await daysProblem(db, w, wo, p.year, p.month, r.daysWorked);
      if (tooMany) { errors[r.workmanId] = tooMany; continue; }
      const { workmanId, ...input } = r;
      for (const k of Object.keys(input)) if (blank(input[k])) delete input[k];
      await saveWageLine(db, sheet.id, Number(workmanId), input);
      saved++;
    } catch (e) {
      if (e instanceof PayrollError || e instanceof RangeError || e instanceof UserError) errors[r.workmanId] = e.message;
      else throw e;
    }
  }
  for (const r of cleared) {
    await db.delete(wageLines).where(and(eq(wageLines.sheetId, sheet.id), eq(wageLines.workmanId, Number(r.workmanId))));
  }
  return { sheetId: sheet.id, saved, removed: cleared.length, errors };
}

/** Delete a draft month (all its lines). Submitted / approved months must be reopened first. */
export async function deleteWages(db, { firmId, sheetId }) {
  const sheet = await sheetOf(db, firmId, sheetId);
  if (sheet.status !== "draft") throw new UserError(`These wages are ${sheet.status}. Press Reopen for Editing first if they really have to be deleted.`);
  await db.delete(monthlySheets).where(eq(monthlySheets.id, sheet.id));
  return { deleted: sheet.id, year: sheet.year, month: sheet.month };
}

export async function submitWages(db, { firmId, sheetId }) {
  const sheet = await sheetOf(db, firmId, sheetId);
  if (sheet.status !== "draft") throw new UserError(`These wages are already ${sheet.status}.`);
  if (sheet.deadline && today() > sheet.deadline) {
    throw new UserError(`The submission deadline (${sheet.deadline}) has passed. You can still save, but submission is closed; change the deadline day in the work order's Config if it was set by mistake.`, { fix: { label: "Open Config", to: "wo_config", params: { wo: sheet.workOrderId } } });
  }
  const lines = await db.select({ id: wageLines.id }).from(wageLines).where(eq(wageLines.sheetId, sheet.id));
  if (!lines.length) throw new UserError("Nothing to submit yet: type the Days Worked and press Save first.");
  const [row] = await db.update(monthlySheets).set({ status: "submitted", submittedAt: new Date() }).where(eq(monthlySheets.id, sheet.id)).returning();
  return row;
}

export async function approveWages(db, { firmId, sheetId }) {
  const sheet = await sheetOf(db, firmId, sheetId);
  if (sheet.status !== "submitted") throw new UserError(sheet.status === "draft" ? "Submit these wages before approving them." : "These wages are already approved.");
  const [row] = await db.update(monthlySheets).set({ status: "approved", approvedAt: new Date() }).where(eq(monthlySheets.id, sheet.id)).returning();
  return row;
}

/** Submitted / approved wages back to draft so they can be corrected (RULES.allowReopenWages). */
export async function reopenWages(db, { firmId, sheetId }) {
  if (!RULES.allowReopenWages) throw new UserError("Reopening submitted wages is switched off in the rules (lib/rules.js).");
  const sheet = await sheetOf(db, firmId, sheetId);
  if (sheet.status === "draft") throw new UserError("These wages are already open for editing.");
  const [row] = await db.update(monthlySheets).set({ status: "draft", submittedAt: null, approvedAt: null }).where(eq(monthlySheets.id, sheet.id)).returning();
  return row;
}

async function sheetOf(db, firmId, sheetId) {
  await firmOf(db, firmId);
  const [s] = await db.select({ sheet: monthlySheets }).from(monthlySheets)
    .innerJoin(workOrders, eq(workOrders.id, monthlySheets.workOrderId))
    .where(and(eq(monthlySheets.id, Number(sheetId)), eq(workOrders.firmId, firmId)));
  if (!s) throw new UserError("Open a work order's wages first (Wages → New Wage Entry).", { fix: { label: "New Wage Entry", to: "wage_new" } });
  return s.sheet;
}

// ---------- dispatch register ----------
export async function saveBill(db, { firmId, billId, values }) {
  await firmOf(db, firmId);
  const { row, errors } = readForm(BILL_FIELDS, values);
  const extra = {};
  if (row.receivedAmount != null && !row.receivedDate) extra["details.receivedDate"] = "Enter the date the amount was received";
  if (row.approved && !row.approvalDate) extra["details.approvalDate"] = "Enter the approval date";
  if (row.receivedDate && row.billDate && row.receivedDate < row.billDate) extra["details.receivedDate"] = "Should be on or after the Bill Date";
  if (row.approvalDate && row.billDate && row.approvalDate < row.billDate) extra["details.approvalDate"] = "Should be on or after the Bill Date";
  failIf(errors, extra);
  if (row.workOrderId) await orderOf(db, firmId, row.workOrderId);
  for (const k of ["gstPaymentStatus", "epfPaymentStatus", "esicPaymentStatus"]) row[k] ??= "Pending";
  row.deduction ??= "0";
  // the amounts are always calculated from the rates (lib/bill.js), never typed
  row.taxRate ??= "0";
  row.gstRate ??= "0";
  const t = billTotals({ taxable: row.taxableAmount, taxRate: row.taxRate, gstRate: row.gstRate });
  Object.assign(row, { taxAmount: t.tax, gstAmount: t.gst, totalAmount: t.total });
  if (billId) {
    const [b] = await db.update(dispatchRegister).set({ ...row, updatedAt: new Date() })
      .where(and(eq(dispatchRegister.id, Number(billId)), eq(dispatchRegister.firmId, firmId))).returning();
    if (!b) throw new UserError("This bill is not in the selected firm.");
    return b;
  }
  const [b] = await db.insert(dispatchRegister).values({ ...row, firmId }).returning();
  return b;
}

export async function getBill(db, { firmId, billId }) {
  await firmOf(db, firmId);
  const [b] = await db.select().from(dispatchRegister).where(and(eq(dispatchRegister.id, Number(billId)), eq(dispatchRegister.firmId, firmId)));
  if (!b) throw new UserError("This bill is not in the selected firm.");
  return toForm(BILL_FIELDS, b);
}

// ---------- delete (records entered by mistake; anything with linked records is refused, naming them) ----------
const linked = (parts) => parts.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}${n === 1 ? "" : "s"}`).join(", ");

export async function deleteFirm(db, { firmId }) {
  const f = await firmOf(db, firmId);
  const count = async (table, col) => (await db.select({ id: table.id }).from(table).where(eq(col, f.id))).length;
  const still = linked([[await count(workOrders, workOrders.firmId), "work order"], [await count(workmen, workmen.firmId), "workman"], [await count(dispatchRegister, dispatchRegister.firmId), "bill"]]);
  if (still) throw new UserError(`"${f.name}" still has ${still}. Delete those first; a firm with records cannot be deleted.`);
  await db.delete(firms).where(eq(firms.id, f.id));
  return { deleted: f.id, name: f.name };
}

export async function deleteWorkOrder(db, { firmId, workOrderId }) {
  const wo = await orderOf(db, firmId, workOrderId);
  const n = async (table, col) => (await db.select({ id: table.id }).from(table).where(eq(col, wo.id))).length;
  const still = linked([[await n(engagements, engagements.workOrderId), "engagement"], [await n(monthlySheets, monthlySheets.workOrderId), "wage month"], [await n(dispatchRegister, dispatchRegister.workOrderId), "bill"]]);
  if (still) {
    throw new UserError(`${wo.woNumber} has ${still}. Delete those first${wo.status === "approved" ? ", or use Mark Completed to close it" : ""}.`, { fix: { label: "Open work order", to: "wo_view", params: { wo: wo.id } } });
  }
  await db.delete(workOrders).where(eq(workOrders.id, wo.id));   // its Config and rates go with it
  return { deleted: wo.id, woNumber: wo.woNumber };
}

export async function deleteWorkman(db, { firmId, workmanId }) {
  const w = await workmanOf(db, firmId, workmanId);
  const engs = (await engagementsOf(db, w.id)).length;
  const paid = (await paidMonthsOf(db, w.id)).length;
  const still = linked([[engs, "engagement"], [paid, "wage month"]]);
  if (still) {
    throw new UserError(`${w.wuin} has ${still}. Delete those first, or set a Date of Exit to move the workman out instead.`, { fix: { label: "Open workman", to: "wm_view", params: { wm: w.id } } });
  }
  await db.delete(workmen).where(eq(workmen.id, w.id));
  return { deleted: w.id, wuin: w.wuin };
}

export async function deleteBill(db, { firmId, billId }) {
  await firmOf(db, firmId);
  const [b] = await db.delete(dispatchRegister).where(and(eq(dispatchRegister.id, Number(billId)), eq(dispatchRegister.firmId, firmId))).returning();
  if (!b) throw new UserError("This bill is not in the selected firm.");
  return { deleted: b.id, billNumber: b.billNumber };
}

// ---------- login ----------
export async function resetPassword(db, { values }) {
  const v = values?.form ?? {};
  const errors = {};
  for (const k of ["current", "new", "confirm"]) if (blank(v[k])) errors[`form.${k}`] = "Required";
  if (!errors["form.new"] && String(v.new).length < 10) errors["form.new"] = "Use at least 10 characters";
  if (!errors["form.confirm"] && v.new !== v.confirm) errors["form.confirm"] = "Does not match the new password";
  failIf(errors);
  const users = await db.select().from(appUsers).orderBy(asc(appUsers.id));
  if (!users.length) throw new UserError("No login has been set up yet, so there is no password to change. Set it up with: ADMIN_USERNAME=… ADMIN_PASSWORD=… npm run db:seed");
  const user = users[0];
  if (!(await bcrypt.compare(String(v.current), user.passwordHash))) throw new UserError("The current password is not correct.", { fields: { "form.current": "Not correct" } });
  await db.update(appUsers).set({ passwordHash: await bcrypt.hash(String(v.new), 12) }).where(eq(appUsers.id, user.id));
  return { username: user.username };
}

// ---------- database errors → plain language ----------
const CONSTRAINTS = {
  firms_name_unique: ["A firm with this name already exists.", "form.name"],
  firms_cuin_unique: ["Another firm already uses this CUIN.", "form.cuin"],
  wo_number_per_firm: ["This firm already has a work order with this number.", "form.woNo"],
  wo_dates_in_order: ["The Date of Completion should be on or after the Date of Commencement.", "form.end"],
  wuin_per_firm: ["This WUIN is already used by another workman in this firm.", "details.wuin"],
  exit_after_joining: ["The Date of Exit should be on or after the Date of Joining.", "details.exitDate"],
  one_open_engagement_per_workman: ["This workman is already engaged on another work order."],
  bill_number_per_firm: ["This firm already has a bill with this number.", "details.billNo"],
  received_date_with_amount: ["Enter the Received Date for the received amount.", "details.receivedDate"],
  config_ot_sane: ["Overtime rate should be at least 1 and working hours between 1 and 24."],
};

/** Map a database error to a UserError, or return null when it is not a known rule. */
export function explainDbError(e) {
  const c = e?.cause ?? e;
  const hit = CONSTRAINTS[c?.constraint];
  if (hit) return new UserError(hit[0], hit[1] ? { fields: { [hit[1]]: hit[0] } } : {});
  if (c?.code === "23505") return new UserError("This record already exists.");
  if (c?.code === "23514" || c?.code === "22P02" || c?.code === "23502") return new UserError("Some values are not valid. Please check the form and try again.");
  return null;
}

export const OPS = {
  createFirm, updateFirm, getFirm, deleteFirm, deleteWorkOrder, deleteWorkman, deleteEngagement, deleteWages, deleteBill,
  createWorkOrder, updateWorkOrder, saveConfig, getWorkOrder, setWorkOrderStatus,
  createWorkman, updateWorkman, getWorkman, setAccommodation,
  engageWorkmen, endEngagement, editEngagement,
  saveWages, submitWages, approveWages, reopenWages,
  saveBill, getBill,
  resetPassword,
};

