// Database schema (PostgreSQL, Drizzle ORM).
// Built from the client's frozen field list: docs/client-spec-v1.json (submitted 12 Oct 2026).
//
// Relations at a glance
//   work_orders 1─* engagements *─1 workmen          who works on which work order, and when
//   work_orders 1─* monthly_sheets                    one sheet per work order per month
//   monthly_sheets 1─* attendance_entries *─1 workmen days worked + OT per workman
//   monthly_sheets 1─* wage_lines *─1 workmen         wages calculated from attendance (snapshot)
//   wage_lines *─1 wage_rates, *─1 statutory_rates    the exact rates used, so old months never change
//   work_orders 1─* dispatch_register                 bills raised and payments received
//
// Money is numeric(12,2) (rupees, exact). Dates without time are `date` (strings "YYYY-MM-DD").
import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, serial, integer, smallint, text, varchar, char, date, timestamp, boolean, numeric,
  uniqueIndex, index, check,
} from "drizzle-orm/pg-core";

const money = (name) => numeric(name, { precision: 12, scale: 2 });
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- enums (option lists exactly as in the client's spec) ----------
export const woStatus = pgEnum("wo_status", ["pending", "approved", "rejected", "completed"]);
export const natureOfWork = pgEnum("nature_of_work", [
  "Coal Loading and Transportation", "MDO", "Mining Activities", "Civil", "E & M", "Watch and Ward", "Others",
]);
export const areaOfOperation = pgEnum("area_of_operation", ["Surface", "Under ground"]);
export const gender = pgEnum("gender", ["Male", "Female", "Others"]);
export const nationality = pgEnum("nationality", ["Indian", "Other"]);
export const skillCategory = pgEnum("skill_category", ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"]);
export const pfType = pgEnum("pf_type", ["CMPF", "EPF"]);
export const religion = pgEnum("religion", ["Hinduism", "Islam", "Christianity", "Sikhism", "Buddhism", "Jainism", "Other"]);
export const accommodation = pgEnum("accommodation", ["Self", "Company Quarter", "Contractors' camp"]);
export const wageCategory = pgEnum("wage_category", ["HPC", "Minimum Wages", "DGR", "Other"]);
export const sheetStatus = pgEnum("sheet_status", ["draft", "submitted", "approved"]);
export const paymentStatus = pgEnum("payment_status", ["Pending", "Paid", "Partially Paid", "Not Applicable"]);

// ---------- login (single login, per proposal) ----------
export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: created(),
});

// ---------- firm settings (one row: dashboard title "Contractor Dashboard for CUIN : …") ----------
export const firmSettings = pgTable("firm_settings", {
  id: smallint("id").primaryKey().default(1),
  firmName: text("firm_name").notNull().default("Secure Eye Security and Manpower Suppliers"),
  cuin: varchar("cuin", { length: 32 }),
  updatedAt: updated(),
}, (t) => [check("firm_settings_single_row", sql`${t.id} = 1`)]);

// ---------- work orders (screens: wo_ongoing / wo_completed / wo_pending / wo_new / wo_edit) ----------
export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  woNumber: varchar("wo_number", { length: 64 }).notNull().unique(), // Work Order Number *
  wouin: varchar("wouin", { length: 32 }),                            // portal id shown as [WOUIN: …], optional
  partyGst: varchar("party_gst", { length: 15 }),                     // Party GST Number
  nameOfWork: text("name_of_work").notNull(),                         // Name of the Work *
  company: text("company").notNull(),                                 // Company *
  areaUnit: text("area_unit"),                                        // "Company / Area / Unit" header on edit
  principalEmployerName: text("principal_employer_name").notNull(),
  principalEmployerDesignation: text("principal_employer_designation").notNull(),
  principalEmployerAddress: text("principal_employer_address"),       // Postal Address of the Principal Employer
  principalEmployerContact: text("principal_employer_contact").notNull(),
  state: text("state").notNull(),                                     // Work Location (State) *
  district: text("district").notNull(),                               // Work Location (District) *
  natureOfWork: natureOfWork("nature_of_work"),                       // on Edit only (hidden on New)
  areaOfOperation: areaOfOperation("area_of_operation"),              // on Edit only
  commencementDate: date("commencement_date").notNull(),
  completionDate: date("completion_date").notNull(),
  engineerInCharge: text("engineer_in_charge"),                       // Engineer In-charge / Auth. Executive
  supervisorName: text("supervisor_name"),
  supervisorPhone: varchar("supervisor_phone", { length: 20 }),
  supervisorPhoneAlt: varchar("supervisor_phone_alt", { length: 20 }),
  supervisorEmail: text("supervisor_email"),
  supervisorEmailAlt: text("supervisor_email_alt"),
  labourLicensePath: text("labour_license_path"),                     // upload: out of proposal scope, column reserved
  remarks: text("remarks"),
  status: woStatus("status").notNull().default("pending"),           // pending → approved (ongoing) → completed
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  check("wo_dates_in_order", sql`${t.completionDate} >= ${t.commencementDate}`),
  index("work_orders_status_idx").on(t.status),
]);

// ---------- workmen (screen: wm_edit; lists wm_active / wm_inactive / wm_photo / wm_moved) ----------
export const workmen = pgTable("workmen", {
  id: serial("id").primaryKey(),                                      // "ID" column on Moved Out list
  wuin: varchar("wuin", { length: 32 }).notNull().unique(),           // Workman Unique ID
  aadhaar: char("aadhaar", { length: 12 }).notNull().unique(),        // not editable after creation (app rule)
  name: text("name").notNull(),
  surname: text("surname"),
  gender: gender("gender").notNull(),
  relativeName: text("relative_name").notNull(),                      // Father's/Mother's/Spouse Name
  dateOfBirth: date("date_of_birth").notNull(),
  nationality: nationality("nationality").notNull().default("Indian"),
  educationLevel: text("education_level"),
  dateOfJoining: date("date_of_joining").notNull(),
  designation: text("designation").notNull(),
  skillCategory: skillCategory("skill_category").notNull(),           // picks the wage rate
  employmentType: text("employment_type"),
  mobile: varchar("mobile", { length: 15 }),
  pfType: pfType("pf_type").notNull(),
  uanOrCmpfNo: varchar("uan_or_cmpf_no", { length: 20 }),
  groupInsuranceNo: varchar("group_insurance_no", { length: 30 }),
  pan: varchar("pan", { length: 10 }),
  esicIp: varchar("esic_ip", { length: 20 }),
  bankAccountNo: varchar("bank_account_no", { length: 20 }).notNull(),
  bankName: text("bank_name"),
  ifsc: varchar("ifsc", { length: 11 }),
  address: text("address").notNull(),                                 // "Address" (was Present Address)
  dateOfExit: date("date_of_exit"),                                   // set → appears under Workmen Moved Out
  identificationMark: text("identification_mark"),
  isDisabled: boolean("is_disabled").notNull().default(false),        // Person With Disability *
  disabilityDetails: text("disability_details"),
  religion: religion("religion"),
  isExServiceman: boolean("is_ex_serviceman").notNull().default(false),
  accommodation: accommodation("accommodation").notNull(),
  wageCategory: wageCategory("wage_category"),
  nomineeName: text("nominee_name"),
  nomineeRelationship: text("nominee_relationship"),
  nomineeDob: date("nominee_dob"),
  nomineeAadhaar: char("nominee_aadhaar", { length: 12 }),
  emergencyContactName: text("emergency_contact_name"),               // Name/Relationship
  emergencyContactAddress: text("emergency_contact_address"),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 15 }),
  photoPath: text("photo_path"),                                      // Workmen Photo: out of proposal scope, column reserved
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  check("aadhaar_12_digits", sql`${t.aadhaar} ~ '^[0-9]{12}$'`),
  check("nominee_aadhaar_12_digits", sql`${t.nomineeAadhaar} IS NULL OR ${t.nomineeAadhaar} ~ '^[0-9]{12}$'`),
  check("exit_after_joining", sql`${t.dateOfExit} IS NULL OR ${t.dateOfExit} >= ${t.dateOfJoining}`),
]);

// ---------- engagements: a workman on a work order for a period ----------
// Active  = an open engagement (engaged_to IS NULL) and no date_of_exit.
// Inactive = no open engagement and no date_of_exit.   Moved out = date_of_exit set.
export const engagements = pgTable("engagements", {
  id: serial("id").primaryKey(),
  workmanId: integer("workman_id").notNull().references(() => workmen.id, { onDelete: "restrict" }),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id, { onDelete: "restrict" }),
  engagedFrom: date("engaged_from").notNull(),
  engagedTo: date("engaged_to"),
  appointmentLetterPath: text("appointment_letter_path"),             // out of proposal scope, column reserved
  createdAt: created(),
}, (t) => [
  check("engagement_dates_in_order", sql`${t.engagedTo} IS NULL OR ${t.engagedTo} >= ${t.engagedFrom}`),
  // a workman can be engaged on only one work order at a time
  uniqueIndex("one_open_engagement_per_workman").on(t.workmanId).where(sql`${t.engagedTo} IS NULL`),
  index("engagements_work_order_idx").on(t.workOrderId),
]);

// ---------- rate masters (maintained by us under the maintenance plan) ----------
export const wageRates = pgTable("wage_rates", {
  id: serial("id").primaryKey(),
  skillCategory: skillCategory("skill_category").notNull(),
  basicDaily: money("basic_daily").notNull(),
  vdaDaily: money("vda_daily").notNull().default("0"),
  otMultiplier: numeric("ot_multiplier", { precision: 4, scale: 2 }).notNull().default("2"), // OT at twice the ordinary rate
  hoursPerDay: smallint("hours_per_day").notNull().default(8),
  effectiveFrom: date("effective_from").notNull(),
  createdAt: created(),
}, (t) => [
  uniqueIndex("wage_rate_per_skill_per_date").on(t.skillCategory, t.effectiveFrom),
  check("wage_rate_positive", sql`${t.basicDaily} > 0 AND ${t.vdaDaily} >= 0`),
]);

export const statutoryRates = pgTable("statutory_rates", {
  id: serial("id").primaryKey(),
  effectiveFrom: date("effective_from").notNull().unique(),
  epfPercent: numeric("epf_percent", { precision: 5, scale: 2 }).notNull().default("12"),
  epfWageCeiling: money("epf_wage_ceiling"),                          // NULL = no cap
  esiPercent: numeric("esi_percent", { precision: 5, scale: 2 }).notNull().default("0.75"),
  esiGrossCeiling: money("esi_gross_ceiling").default("21000"),       // ESI only when gross <= ceiling; NULL = always
  createdAt: created(),
});

// ---------- monthly sheet: one per work order per month (attendance → wages) ----------
export const monthlySheets = pgTable("monthly_sheets", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id, { onDelete: "restrict" }),
  year: smallint("year").notNull(),
  month: smallint("month").notNull(),
  attendanceStatus: sheetStatus("attendance_status").notNull().default("draft"),
  attendanceSubmittedAt: timestamp("attendance_submitted_at", { withTimezone: true }),
  wageStatus: sheetStatus("wage_status").notNull().default("draft"),
  wageSubmittedAt: timestamp("wage_submitted_at", { withTimezone: true }),
  wageApprovedAt: timestamp("wage_approved_at", { withTimezone: true }),
  wageDeadline: date("wage_deadline"),
  proofOfWagePfPath: text("proof_of_wage_pf_path"),
  createdAt: created(),
}, (t) => [
  uniqueIndex("one_sheet_per_work_order_month").on(t.workOrderId, t.year, t.month),
  check("month_1_to_12", sql`${t.month} BETWEEN 1 AND 12`),
  check("year_sane", sql`${t.year} BETWEEN 2020 AND 2100`),
  // wages can only move past draft once attendance is submitted
  check("wages_after_attendance", sql`${t.wageStatus} = 'draft' OR ${t.attendanceStatus} <> 'draft'`),
]);

export const attendanceEntries = pgTable("attendance_entries", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id").notNull().references(() => monthlySheets.id, { onDelete: "cascade" }),
  workmanId: integer("workman_id").notNull().references(() => workmen.id, { onDelete: "restrict" }),
  daysWorked: numeric("days_worked", { precision: 4, scale: 1 }).notNull(), // Days Worked (this month)
  otHours: smallint("ot_hours").notNull().default(0),
  otMinutes: smallint("ot_minutes").notNull().default(0),
  remarks: text("remarks"),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("one_attendance_row_per_workman").on(t.sheetId, t.workmanId),
  check("days_0_to_31", sql`${t.daysWorked} >= 0 AND ${t.daysWorked} <= 31`),
  check("ot_hours_non_negative", sql`${t.otHours} >= 0`),
  check("ot_minutes_quarter_hours", sql`${t.otMinutes} IN (0, 15, 30, 45)`),
]);

// Wage lines are a SNAPSHOT: rates and results are copied in, so a rate revision never changes a past month.
export const wageLines = pgTable("wage_lines", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id").notNull().references(() => monthlySheets.id, { onDelete: "cascade" }),
  workmanId: integer("workman_id").notNull().references(() => workmen.id, { onDelete: "restrict" }),
  wageRateId: integer("wage_rate_id").notNull().references(() => wageRates.id, { onDelete: "restrict" }),
  statutoryRateId: integer("statutory_rate_id").notNull().references(() => statutoryRates.id, { onDelete: "restrict" }),
  daysWorked: numeric("days_worked", { precision: 4, scale: 1 }).notNull(),
  basicRate: money("basic_rate").notNull(),
  vdaRate: money("vda_rate").notNull(),
  basicVdaEarned: money("basic_vda_earned").notNull(),
  otAmount: money("ot_amount").notNull().default("0"),
  ugAllowance: money("ug_allowance").notNull().default("0"),
  bonus: money("bonus").notNull().default("0"),
  edlis: money("edlis").notNull().default("0"),
  pli: money("pli").notNull().default("0"),
  otherEarnings: money("other_earnings").notNull().default("0"),
  grossEarnings: money("gross_earnings").notNull(),
  epfDeduction: money("epf_deduction").notNull(),
  esiDeduction: money("esi_deduction").notNull(),
  otherDeduction: money("other_deduction").notNull().default("0"),
  damageRecovery: money("damage_recovery").notNull().default("0"),
  totalDeduction: money("total_deduction").notNull(),
  netEarnings: money("net_earnings").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("one_wage_line_per_workman").on(t.sheetId, t.workmanId),
  check("net_is_gross_minus_deductions", sql`${t.netEarnings} = ${t.grossEarnings} - ${t.totalDeduction}`),
  check("extras_non_negative", sql`${t.ugAllowance} >= 0 AND ${t.bonus} >= 0 AND ${t.edlis} >= 0 AND ${t.pli} >= 0 AND ${t.otherEarnings} >= 0 AND ${t.otherDeduction} >= 0 AND ${t.damageRecovery} >= 0`),
]);

// ---------- Compliance → Dispatch Register (bills and payment status) ----------
export const dispatchRegister = pgTable("dispatch_register", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  partyNameContract: text("party_name_contract").notNull(),          // Party Name / Contract Number
  billNumber: varchar("bill_number", { length: 64 }).notNull().unique(),
  billDate: date("bill_date").notNull(),
  taxableAmount: money("taxable_amount").notNull(),
  gstAmount: money("gst_amount").notNull().default("0"),
  receivedAmount: money("received_amount"),
  receivedDate: date("received_date"),
  deduction: money("deduction").notNull().default("0"),
  remark: text("remark"),
  gstPaymentStatus: paymentStatus("gst_payment_status").notNull().default("Pending"),
  epfPaymentStatus: paymentStatus("epf_payment_status").notNull().default("Pending"),
  esicPaymentStatus: paymentStatus("esic_payment_status").notNull().default("Pending"),
  approved: boolean("approved").notNull().default(false),
  approvedBy: text("approved_by"),
  approvalDate: date("approval_date"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  check("bill_amounts_non_negative", sql`${t.taxableAmount} >= 0 AND ${t.gstAmount} >= 0 AND ${t.deduction} >= 0`),
  check("received_date_with_amount", sql`${t.receivedAmount} IS NULL OR ${t.receivedDate} IS NOT NULL`),
  index("dispatch_register_bill_date_idx").on(t.billDate),
]);
