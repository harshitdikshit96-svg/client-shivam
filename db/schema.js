// Database schema (PostgreSQL, Drizzle ORM).
// Built from the client's frozen field list: docs/client-spec-v1.json (submitted 12 Oct 2026).
//
// Relations at a glance
//   firms 1─* work_orders, workmen, dispatch_register   everything belongs to one firm (Create Firm)
//   work_orders 1─1 work_order_config, 1─* work_order_rates   the order's Config: deductions/OT + per-day wage by skill
//   work_orders 1─* engagements *─1 workmen            who works on which work order, and when (same firm, enforced)
//   work_orders 1─* monthly_sheets 1─* wage_lines *─1 workmen
//        days worked are typed on the wage line; wages are calculated from them and the order's Config,
//        and the rates used are copied onto the line, so changing Config never alters a submitted month
//
// Money is numeric(12,2) (rupees, exact). Dates without time are `date` (strings "YYYY-MM-DD").
//
// Keys: every table has a generated `id` primary key and tables point at each other only through ids, so every
// typed value (Aadhaar, WUIN, work order number, bill number, firm name…) can be edited without breaking a link.
// Typed identifiers that people search by (work order number, WUIN, bill number, firm name/CUIN) stay unique
// within the firm. Format and business rules that may need relaxing (Aadhaar format / uniqueness, phone, PAN…)
// are not database constraints: they live in lib/rules.js and are checked by lib/ops.js.
import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, serial, integer, smallint, text, varchar, char, date, timestamp, boolean, numeric,
  uniqueIndex, index, check, unique, primaryKey, foreignKey,
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

// Logged-in browsers. The cookie holds a random token; only its SHA-256 is stored, so a copy of the database cannot
// be used to log in. Logout and a password change delete rows here, which ends those sessions immediately.
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  createdAt: created(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// ---------- firms (navbar: Create Firm / firm switcher) ----------
export const firms = pgTable("firms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),                              // Firm Name *
  cuin: varchar("cuin", { length: 32 }).unique(),                     // shown in "Contractor Dashboard for CUIN : …"
  registrationNo: text("registration_no"),
  gstin: varchar("gstin", { length: 15 }),
  pan: varchar("pan", { length: 10 }),
  pfRegistrationNo: varchar("pf_registration_no", { length: 32 }),
  esicNo: varchar("esic_no", { length: 32 }),
  mobile: varchar("mobile", { length: 15 }),
  email: text("email"),
  state: text("state"),
  address: text("address"),
  pincode: varchar("pincode", { length: 6 }),
  createdAt: created(),
  updatedAt: updated(),
});

// ---------- work orders (screens: wo_ongoing / wo_completed / wo_pending / wo_new / wo_edit) ----------
export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "restrict" }),
  woNumber: varchar("wo_number", { length: 64 }).notNull(),           // Work Order Number * (unique within a firm)
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
  uniqueIndex("wo_number_per_firm").on(t.firmId, t.woNumber),
  unique("work_orders_firm_id_id").on(t.firmId, t.id),                // target of same-firm foreign keys
  index("work_orders_status_idx").on(t.firmId, t.status),
]);

// ---------- work order Config (entered order by order) ----------
export const workOrderConfig = pgTable("work_order_config", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().unique().references(() => workOrders.id, { onDelete: "cascade" }),
  epfPercent: numeric("epf_percent", { precision: 5, scale: 2 }).notNull().default("12"),
  epfWageCeiling: money("epf_wage_ceiling"),                          // NULL = no cap
  esiPercent: numeric("esi_percent", { precision: 5, scale: 2 }).notNull().default("0.75"),
  esiGrossCeiling: money("esi_gross_ceiling").default("21000"),       // ESI only when gross <= this; NULL = always
  otMultiplier: numeric("ot_multiplier", { precision: 4, scale: 2 }).notNull().default("2"),
  hoursPerDay: smallint("hours_per_day").notNull().default(8),
  deadlineDay: smallint("deadline_day"),                              // wage submission deadline: day of next month
  updatedAt: updated(),
}, (t) => [
  check("config_percents_sane", sql`${t.epfPercent} BETWEEN 0 AND 100 AND ${t.esiPercent} BETWEEN 0 AND 100`),
  check("config_ot_sane", sql`${t.otMultiplier} >= 1 AND ${t.hoursPerDay} BETWEEN 1 AND 24`),
  check("config_deadline_day", sql`${t.deadlineDay} IS NULL OR ${t.deadlineDay} BETWEEN 1 AND 31`),
]);

// Per Day Wage + VDA per skill category, per work order
export const workOrderRates = pgTable("work_order_rates", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  skillCategory: skillCategory("skill_category").notNull(),
  basicDaily: money("basic_daily").notNull(),
  vdaDaily: money("vda_daily").notNull().default("0"),
  updatedAt: updated(),
}, (t) => [
  uniqueIndex("one_rate_per_skill").on(t.workOrderId, t.skillCategory),
  check("rate_positive", sql`${t.basicDaily} > 0 AND ${t.vdaDaily} >= 0`),
]);

// ---------- workmen (screen: wm_edit; lists wm_active / wm_inactive / wm_moved) ----------
export const workmen = pgTable("workmen", {
  id: serial("id").primaryKey(),                                      // "ID" column on Moved Out list
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "restrict" }),
  wuin: varchar("wuin", { length: 32 }).notNull(),                    // Workman Unique ID (unique within a firm)
  aadhaar: varchar("aadhaar", { length: 20 }).notNull(),              // editable; format + uniqueness: lib/rules.js
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
  nomineeAadhaar: varchar("nominee_aadhaar", { length: 20 }),
  emergencyContactName: text("emergency_contact_name"),               // Name/Relationship
  emergencyContactAddress: text("emergency_contact_address"),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 15 }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  check("exit_after_joining", sql`${t.dateOfExit} IS NULL OR ${t.dateOfExit} >= ${t.dateOfJoining}`),
  uniqueIndex("wuin_per_firm").on(t.firmId, t.wuin),
  index("workmen_aadhaar_idx").on(t.firmId, t.aadhaar),               // looked up, not forced unique (lib/rules.js)
  unique("workmen_firm_id_id").on(t.firmId, t.id),
]);

// ---------- engagements: a workman on a work order for a period ----------
// Active  = an open engagement (engaged_to IS NULL) and no date_of_exit.
// Inactive = no open engagement and no date_of_exit.   Moved out = date_of_exit set.
export const engagements = pgTable("engagements", {
  id: serial("id").primaryKey(),
  firmId: integer("firm_id").notNull(),
  workmanId: integer("workman_id").notNull(),
  workOrderId: integer("work_order_id").notNull(),
  engagedFrom: date("engaged_from").notNull(),
  engagedTo: date("engaged_to"),
  appointmentLetterPath: text("appointment_letter_path"),             // out of proposal scope, column reserved
  createdAt: created(),
}, (t) => [
  check("engagement_dates_in_order", sql`${t.engagedTo} IS NULL OR ${t.engagedTo} >= ${t.engagedFrom}`),
  // workman and work order must belong to the same firm
  foreignKey({ columns: [t.firmId, t.workmanId], foreignColumns: [workmen.firmId, workmen.id], name: "engagement_workman_same_firm" }).onDelete("restrict"),
  foreignKey({ columns: [t.firmId, t.workOrderId], foreignColumns: [workOrders.firmId, workOrders.id], name: "engagement_work_order_same_firm" }).onDelete("restrict"),
  // a workman can be engaged on only one work order at a time
  uniqueIndex("one_open_engagement_per_workman").on(t.workmanId).where(sql`${t.engagedTo} IS NULL`),
  index("engagements_work_order_idx").on(t.workOrderId),
]);

// ---------- monthly sheet: one per work order per month (attendance → wages) ----------
export const monthlySheets = pgTable("monthly_sheets", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id, { onDelete: "restrict" }),
  year: smallint("year").notNull(),
  month: smallint("month").notNull(),
  status: sheetStatus("status").notNull().default("draft"),           // draft → submitted (locked) → approved
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  deadline: date("deadline"),
  proofOfWagePfPath: text("proof_of_wage_pf_path"),
  createdAt: created(),
}, (t) => [
  uniqueIndex("one_sheet_per_work_order_month").on(t.workOrderId, t.year, t.month),
  check("month_1_to_12", sql`${t.month} BETWEEN 1 AND 12`),
  check("year_sane", sql`${t.year} BETWEEN 2020 AND 2100`),
]);

// One row per workman per month. Days worked / OT / extras are TYPED; everything else is CALCULATED
// from them and the work order's Config, and the Config values used are copied in (snapshot).
export const wageLines = pgTable("wage_lines", {
  id: serial("id").primaryKey(),
  sheetId: integer("sheet_id").notNull().references(() => monthlySheets.id, { onDelete: "cascade" }),
  workmanId: integer("workman_id").notNull().references(() => workmen.id, { onDelete: "restrict" }),
  // typed on the Wage Entry screen
  daysWorked: numeric("days_worked", { precision: 4, scale: 1 }).notNull(),
  otHours: smallint("ot_hours").notNull().default(0),
  otMinutes: smallint("ot_minutes").notNull().default(0),
  ugAllowance: money("ug_allowance").notNull().default("0"),
  bonus: money("bonus").notNull().default("0"),
  edlis: money("edlis").notNull().default("0"),
  pli: money("pli").notNull().default("0"),
  otherEarnings: money("other_earnings").notNull().default("0"),
  cmpsDeduction: money("cmps_deduction").notNull().default("0"),     // CMPS Deduction (typed)
  fine: money("fine").notNull().default("0"),                         // Fine (typed)
  otherDeduction: money("other_deduction").notNull().default("0"),
  damageRecovery: money("damage_recovery").notNull().default("0"),
  remarks: text("remarks"),
  // Config snapshot
  skillCategory: skillCategory("skill_category").notNull(),
  basicRate: money("basic_rate").notNull(),
  vdaRate: money("vda_rate").notNull(),
  epfPercent: numeric("epf_percent", { precision: 5, scale: 2 }).notNull(),
  esiPercent: numeric("esi_percent", { precision: 5, scale: 2 }).notNull(),
  otMultiplier: numeric("ot_multiplier", { precision: 4, scale: 2 }).notNull(),
  // calculated
  basicVdaEarned: money("basic_vda_earned").notNull(),
  otAmount: money("ot_amount").notNull().default("0"),
  grossEarnings: money("gross_earnings").notNull(),
  epfDeduction: money("epf_deduction").notNull(),
  esiDeduction: money("esi_deduction").notNull(),
  totalDeduction: money("total_deduction").notNull(),
  netEarnings: money("net_earnings").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("one_wage_line_per_workman").on(t.sheetId, t.workmanId),
  check("days_0_to_31", sql`${t.daysWorked} >= 0 AND ${t.daysWorked} <= 31`),
  check("ot_hours_non_negative", sql`${t.otHours} >= 0`),
  check("ot_minutes_quarter_hours", sql`${t.otMinutes} IN (0, 15, 30, 45)`),
  check("net_is_gross_minus_deductions", sql`${t.netEarnings} = ${t.grossEarnings} - ${t.totalDeduction}`),
  check("extras_non_negative", sql`${t.ugAllowance} >= 0 AND ${t.bonus} >= 0 AND ${t.edlis} >= 0 AND ${t.pli} >= 0 AND ${t.otherEarnings} >= 0 AND ${t.otherDeduction} >= 0 AND ${t.damageRecovery} >= 0`),
  check("cmps_fine_non_negative", sql`${t.cmpsDeduction} >= 0 AND ${t.fine} >= 0`),
]);

// ---------- Compliance → Dispatch Register (bills and payment status) ----------
export const dispatchRegister = pgTable("dispatch_register", {
  id: serial("id").primaryKey(),
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "restrict" }),   // Select Firm
  workOrderId: integer("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  partyNameContract: text("party_name_contract").notNull(),          // Party Name / Contract Number
  billNumber: varchar("bill_number", { length: 64 }).notNull(),
  billDate: date("bill_date").notNull(),
  taxableAmount: money("taxable_amount").notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),   // Tax Rate (%): 0 / 5 / 18 / other
  taxAmount: money("tax_amount").notNull().default("0"),                              // calculated: taxable × tax rate
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),   // GST Rate (%): 0 / 5 / 18 / other
  gstAmount: money("gst_amount").notNull().default("0"),                              // calculated: taxable × GST rate
  totalAmount: money("total_amount").notNull().default("0"),                          // taxable + tax + GST
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
  check("bill_tax_amounts_non_negative", sql`${t.taxAmount} >= 0 AND ${t.totalAmount} >= 0`),
  check("bill_rates_percent", sql`${t.taxRate} BETWEEN 0 AND 100 AND ${t.gstRate} BETWEEN 0 AND 100`),
  check("received_date_with_amount", sql`${t.receivedAmount} IS NULL OR ${t.receivedDate} IS NOT NULL`),
  uniqueIndex("bill_number_per_firm").on(t.firmId, t.billNumber),
  index("dispatch_register_bill_date_idx").on(t.firmId, t.billDate),
]);
