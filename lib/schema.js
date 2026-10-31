// Single source of truth for every screen of the prototype.
// Every menu item, block, column, field and button has a stable id.
// Ids are scoped per screen: "<screen>.<block>.<item>", so hiding a column on one
// screen never affects another, even when screens share a column set.
//
// Item flags:
//   locked:   true  -> cannot be hidden (system / read-only / calculated fields)
//   readOnly: true  -> rendered as a read-only input (none at the moment: CR-3 makes every field editable;
//                      fields can be locked after saving through lib/rules.js → lockedAfterCreate)
//   req:      true  -> shown with a red * (no restriction on hiding)
//   calc:     "..." -> calculated column; the text describes the formula
//   feeds:    [...] -> hiding it asks for confirmation, naming these calculated outputs
import { TAX_RATES } from "./bill.js";

export const APP_TITLE = "Contractor Portal";

// Top navbar: firm switcher + Create Firm. Every work order, workman, wage sheet and bill belongs to one firm.
export const HEADER = {
  firmSwitcher: { label: "Firm", placeholder: "— select firm —" },
  actions: [{ id: "createFirm", label: "Create Firm", to: "create_firm" }],
};

// Wage configuration shown on New / Edit Work Order and on Work Order Config.
export const SKILL_CATEGORIES = ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"];
export const WAGE_DEFAULTS = { epfPercent: 12, epfWageCeiling: null, esiPercent: 0.75, esiGrossCeiling: 21000, otMultiplier: 2, hoursPerDay: 8 };

// ---------- shared column / field sets ----------
const c = (id, label, extra = {}) => ({ id, label, ...extra });

const WO_LIST = [
  c("sl", "Sl#", { locked: true }),
  c("woNo", "Work Order Number", { locked: true }),
  c("workName", "Name of the Work"),
  c("state", "Work Location (State)"),
  c("nature", "Nature of Work"),
  c("start", "Date of Commencement"),
  c("end", "Date of Completion"),
  c("engineer", "Engineer In-charge / Auth. Executive"),
];

const PERIOD_LIST = [
  c("sl", "Sl#", { locked: true }),
  c("woNo", "Work Order Number", { locked: true }),
  c("workName", "Name of the Work"),
  c("nature", "Nature of Work"),
  c("start", "Date of Commencement"),
  c("end", "Date of Completion"),
];
// CR-2: what each wage list adds to the v1 columns
const PERIOD_STATUS = [
  c("period", "Period"), c("wageStatus", "Wage Status"), c("workmenCount", "Workmen"), c("net", "Net Payable (₹)"),
];

const WORKMEN_LIST = [
  c("sl", "Sl#", { locked: true }),
  c("wuin", "WUIN", { locked: true }),
  c("name", "Name"),
  c("surname", "Surname"),
  c("dob", "Date of Birth"),
  c("gender", "Gender"),
  c("skill", "Skill Category"),
  c("designation", "Designation"),
  c("engagedIn", "Engaged in (Workorder)"),
  c("engagedFrom", "Engaged From"),
  c("lastAtt", "Last Attendance Date"),
  c("action", "Action", { kind: "action", btn: "Edit" }),
  c("engBefore", "Engagement Before Last Attendance", { kind: "action", btn: "Manage Engagements" }),
];

export const PAYMENT_STATUS = ["Pending", "Paid", "Partially Paid", "Not Applicable"];
export const ACCOMMODATION = ["Self", "Company Quarter", "Contractors' camp"];

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];
const NATURE_OF_WORK = ["Coal Loading and Transportation", "MDO", "Mining Activities", "Civil", "E & M", "Watch and Ward", "Others"];
const AREA_OF_OPERATION = ["Surface", "Under ground"];

const periodFilter = (id = "period") => ({
  id,
  type: "filter",
  title: "Select Period:",
  items: [
    c("year", "Year", { input: "select", options: ["2021", "2022", "2023", "2024", "2025", "2026"] }),
    c("month", "Month", {
      input: "select",
      options: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    }),
    c("search", "Search", { input: "button" }),
  ],
});

// Config menu of a work order: per-day wages by skill + statutory/OT settings (entered order by order)
const wageConfigBlocks = () => [
  {
    id: "rates", type: "rates", title: "Config — Per Day Wages", note: "Enter the daily wage agreed in this work order for each skill category used. Leave a row blank if not used.",
    rows: SKILL_CATEGORIES.map((s) => ({ id: s.toLowerCase().replace(/ /g, "_"), label: s })),
    items: [
      c("basicDaily", "Per Day Wage (₹)", { input: "number" }),
      c("vdaDaily", "VDA per Day (₹)", { input: "number" }),
    ],
  },
  {
    id: "statutory", type: "form", title: "Config — Deductions & Overtime", items: [
      c("epfPercent", "EPF / CMPF (% of wages)", { req: true, input: "number", def: WAGE_DEFAULTS.epfPercent }),
      c("epfWageCeiling", "EPF wage ceiling (₹ per month, blank = no cap)", { input: "number" }),
      c("esiPercent", "ESI (% of gross)", { req: true, input: "number", def: WAGE_DEFAULTS.esiPercent }),
      c("esiGrossCeiling", "ESI applies up to gross of (₹ per month)", { input: "number", def: WAGE_DEFAULTS.esiGrossCeiling }),
      c("otMultiplier", "Overtime rate (× normal hourly rate)", { req: true, input: "number", def: WAGE_DEFAULTS.otMultiplier }),
      c("hoursPerDay", "Working hours per day", { req: true, input: "number", def: WAGE_DEFAULTS.hoursPerDay }),
      c("deadlineDay", "Wage submission deadline (day of next month)", { input: "number" }),
    ],
  },
];

// ---------- menu ----------
// CR-2: Home first; Submitted / Approved Wages and Worker Wage Slip reachable from the menu.
export const MENU = [
  { id: "home", label: "Home", screen: "home", locked: true },
  {
    id: "wo", label: "Work Order", items: [
      { id: "ongoing", label: "Ongoing Work Order", screen: "wo_ongoing" },
      { id: "completed", label: "Completed Work Order", screen: "wo_completed" },
      { id: "pending", label: "Pending Work Order Approval", screen: "wo_pending" },
    ],
  },
  {
    id: "workmen", label: "Workmen", items: [
      { id: "engage", label: "Engage Workmen Against Work Order", screen: "wm_engage" },
      { id: "active", label: "View Active Workmen", screen: "wm_active" },
      { id: "inactive", label: "View Inactive Workmen", screen: "wm_inactive" },
      { id: "moved", label: "Workmen Moved Out", screen: "wm_moved" },
    ],
  },
  // Attendance is typed directly on the Wage Entry screen (change request, 15 Oct 2026).
  {
    id: "wages", label: "Wages", items: [
      { id: "new", label: "New Wage Entry", screen: "wage_new" },
      { id: "submitted", label: "Submitted Wages", screen: "wage_submitted" },
      { id: "approved", label: "Approved Wages", screen: "wage_approved" },
      { id: "slip", label: "Worker Wage Slip", screen: "wage_slip" },
    ],
  },
  {
    id: "compliance", label: "Compliance", items: [
      { id: "dispatch", label: "Dispatch Register", screen: "dispatch_register" },
      { id: "reset", label: "Reset Password", screen: "reset_pw" },
    ],
  },
  { id: "logout", label: "Logout", locked: true },
];

// ---------- screens ----------
export const SCREENS = [
  {
    id: "home",
    title: "Contractor Dashboard for CUIN : ——",
    blocks: [
      // CR-2: shown until the firm has done each step once; every step links to the screen that does it
      {
        id: "setup", type: "checklist", title: "Getting started", items: [
          c("firm", "Create a firm", { to: "create_firm" }),
          c("wo", "Create a work order with its Config (per day wages)", { to: "wo_new" }),
          c("approve", "Approve the work order", { to: "wo_pending" }),
          c("workman", "Add workmen", { to: "wm_edit" }),
          c("engage", "Engage workmen on the work order", { to: "wm_engage" }),
          c("wages", "Enter wages for a month", { to: "wage_new" }),
        ],
      },
      {
        id: "stats", type: "stats", title: "Summary cards", items: [
          c("pending", "Pending Work Order Approvals", { to: "wo_pending" }),
          c("approved", "Approved Work Orders", { to: "wo_ongoing" }),
          c("rejected", "Rejected Work Orders", { to: "wo_pending" }),
        ],
      },
      {
        id: "alerts", type: "card", title: "Alerts", tone: "warn", items: [
          c("a1", "Attendance Entry Update: Overtime (OT) entry is now enabled. Enter OT Hours and OT Minutes in 15-minute intervals (0, 15, 30, 45)."),
          c("a2", "Wage Entry Enhancements: PLI option is now available. System will validate Skill Category and Social Category before saving. Use the WUIN link for quick update of missing details."),
          c("a3", "Manage Engagements: available under View Active, View Inactive Workmen and Moved Out Workmen. Use this to engage workmen for dates before the last attendance date."),
        ],
      },
      { id: "recent", type: "card", title: "Recent Work Order Activities", tone: "grey", half: true, items: [c("empty", "No recent activity")] },
      {
        id: "compliance", type: "card", title: "Compliance Summary", tone: "grey", half: true, items: [
          c("s1", "Step 1: Register Workmen — Workmen → Engage Workmen Against Work Order lists all workmen. Use New Workman if a workman is not available."),
          c("s2", "Step 2: Engage Workmen — use Engage Workmen Against Work Order. Engagement allowed from dates after the last attendance date."),
          c("s3", "Step 3: Wage Entry — Wages → New Wage Entry. Choose the work order and month, type Days Worked (and OT) for each engaged workman, Save, then Submit after verification."),
          c("s4", "Step 4: Track — Submitted Wages, Approved Wages and Worker Wage Slip under Wages; bills and GST/EPF/ESIC payment status in Compliance → Dispatch Register."),
          c("imp", "Important: ensure workmen engagement is correct and all mandatory workman fields are filled before wage entry."),
        ],
      },
    ],
  },

  // ----- Work Order -----
  {
    id: "wo_ongoing", title: "Ongoing Work Orders / Contracts", blocks: [
      {
        id: "list", type: "table", title: "Work order list", items: [
          ...WO_LIST,
          c("workmenCount", "Workmen Engaged"),
          c("update", "Update Work Order", { kind: "action", btn: "Edit", to: "wo_edit" }),
          c("engage", "Workmen Engagement", { kind: "action", btn: "Engage", to: "wm_engage" }),
          c("config", "Config", { kind: "action", btn: "Config", to: "wo_config" }),
          c("wages", "Wages", { kind: "action", btn: "Wage Entry", to: "wage_entry" }),
          c("complete", "Close", { kind: "action", btn: "Mark Completed" }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("create", "Create New Work Order", { to: "wo_new" })] },
    ],
  },
  {
    id: "wo_completed", title: "Completed Work Orders / Contracts", blocks: [{
      id: "list", type: "table", title: "Work order list",
      items: [...WO_LIST, c("workmenCount", "Workmen Engaged"), c("reopen", "Reopen", { kind: "action", btn: "Reopen" })],
    }],
  },
  {
    // CR-2: the single login approves; rejected orders are listed here too so they can be corrected and resubmitted
    id: "wo_pending", title: "Approval Pending Work Orders / Contracts", blocks: [
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: A work order must be approved before workmen can be engaged on it or wages entered. Check its Config (per day wages) first.")] },
      {
        id: "list", type: "table", title: "Work order list", items: [
          ...WO_LIST, c("status", "Status"),
          c("config", "Config", { kind: "action", btn: "Config", to: "wo_config" }),
          c("approve", "Approve", { kind: "action", btn: "Approve" }),
          c("reject", "Reject", { kind: "action", btn: "Reject" }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("create", "Create New Work Order", { to: "wo_new" })] },
    ],
  },
  {
    // CR-2: one place for a work order and everything linked to it
    id: "wo_view", title: "Work Order —", hiddenFromMenu: true, blocks: [
      {
        id: "details", type: "kv", title: "Work order details", items: [
          c("woNo", "Work Order Number"), c("firm", "Firm"), c("status", "Status"), c("workName", "Name of the Work"),
          c("company", "Company"), c("peName", "Principal Employer"), c("state", "Work Location (State)"), c("district", "Work Location (District)"),
          c("nature", "Nature of Work"), c("start", "Date of Commencement"), c("end", "Date of Completion"), c("svName", "Supervisor"),
        ],
      },
      {
        id: "actions", type: "buttons", title: "Buttons", items: [
          c("edit", "Edit Work Order", { to: "wo_edit" }), c("config", "Config", { to: "wo_config" }), c("engage", "Engage Workmen", { to: "wm_engage" }),
          c("wages", "Wage Entry", { to: "wage_entry" }), c("approve", "Approve", { tone: "green" }), c("reject", "Reject", { tone: "outline" }),
          c("resubmit", "Resubmit for Approval"), c("complete", "Mark Completed", { tone: "outline" }), c("reopen", "Reopen"),
          c("delete", "Delete Work Order", { tone: "danger" }),
        ],
      },
      {
        id: "workmen", type: "table", title: "Workmen on this work order", items: [
          c("wuin", "WUIN"), c("name", "Name"), c("skill", "Skill Category"), c("designation", "Designation"),
          c("from", "Engaged From"), c("to", "Engaged To"), c("status", "Status"),
          c("edit", "Edit Dates", { kind: "action", btn: "Edit" }), c("end", "End Engagement", { kind: "action", btn: "End" }),
          c("del", "Delete", { kind: "action", btn: "Delete", danger: true }),
        ],
      },
      {
        id: "sheets", type: "table", title: "Wage months", items: [
          c("period", "Period"), c("wageStatus", "Wage Status"), c("workmenCount", "Workmen"), c("gross", "Gross (₹)"),
          c("totalDed", "Deductions (₹)"), c("net", "Net Payable (₹)"), c("open", "Open", { kind: "action", btn: "Open", to: "wage_entry" }),
        ],
      },
      {
        id: "bills", type: "table", title: "Bills (Dispatch Register)", items: [
          c("billNo", "Bill Number"), c("billDate", "Bill Date"), c("taxable", "Taxable Amount"), c("received", "Received Amount"),
          c("approved", "Approved"), c("open", "Open", { kind: "action", btn: "Open", to: "dispatch_register" }),
        ],
      },
    ],
  },
  {
    id: "wo_edit", title: "Edit Work Order / Contract", hiddenFromMenu: true, blocks: [
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: Fields marked * are mandatory.")] },
      {
        id: "header", type: "kv", title: "Work order header", items: [
          c("woNo", "Work Order Number", { locked: true }),
          c("workName", "Name of the Work", { locked: true }),
          c("company", "Company / Area / Unit", { locked: true }),
        ],
      },
      {
        id: "form", type: "form", title: "Work order details", items: [
          // CR-3: everything entered on New Work Order can be corrected here
          c("woNo", "Work Order Number", { req: true, locked: true }),
          c("partyGst", "Party GST Number"),
          c("workName", "Name of the Work", { req: true, input: "textarea" }),
          c("company", "Company", { req: true }),
          c("start", "Date of Commencement", { req: true, input: "date" }),
          c("end", "Date of Completion", { req: true, input: "date" }),
          c("peContact", "Contact Details of Principal Employer", { req: true }),
          c("peName", "Name of the Principal Employer", { req: true, locked: true }),
          c("svName", "Name of the supervisor / Auth. Personnel representing the contractor"),
          c("peDesig", "Designation of the Principal Employer", { req: true, locked: true }),
          c("svPhone", "Contact Number of the Supervisor / Auth. Personnel representing the contractor"),
          c("peAddr", "Address of the Principal Employer", { locked: true, input: "textarea" }),
          c("svPhone2", "Alternate Contact Number of the Supervisor / Auth. Personnel representing the contractor"),
          c("state", "Work Location (State)", { req: true, input: "select", options: STATES }),
          c("svEmail", "Email Address of the Supervisor / Auth. Personnel representing the contractor"),
          c("district", "Work Location (District)", { req: true, suggestFrom: "state", placeholder: "Pick from the list or type" }),
          c("svEmail2", "Alternate Email Address of the Supervisor / Auth. Personnel representing the contractor"),
          c("nature", "Nature of Work", { input: "select", options: NATURE_OF_WORK }),
          c("license", "Upload Labour License [ PDF file less than 1MB]", { input: "file", upload: true }),
          c("areaOp", "Area of Operation", { input: "select", options: AREA_OF_OPERATION }),
          c("remarks", "Remarks"),
        ],
      },
      ...wageConfigBlocks(),
      { id: "actions", type: "buttons", title: "Buttons", items: [c("submit", "Submit")] },
    ],
  },

  {
    id: "wo_new", title: "New Work Order / Contract", hiddenFromMenu: true, blocks: [
      {
        id: "note", type: "notes", title: "Notes", items: [
          c("n1", "Note: Please fill in the details below and submit for approval by admin user corresponding to selection made in Company/Area/Unit fields."),
          c("n2", "Note: Fields marked * are mandatory."),
        ],
      },
      {
        // two-column grid fills row by row: left column item, then right column item
        id: "form", type: "form", title: "Work order details", items: [
          c("woNo", "Work Order Number", { req: true, locked: true }),
          c("partyGst", "Party GST Number"),
          c("workName", "Name of the Work", { req: true, input: "textarea" }),
          c("peName", "Name of the Principal Employer", { req: true }),
          c("start", "Date of Commencement", { req: true, input: "date" }),
          c("peDesig", "Designation of the Principal Employer", { req: true }),
          c("end", "Date of Completion", { req: true, input: "date" }),
          c("peAddr", "Postal Address of the Principal Employer", { input: "textarea" }),
          c("company", "Company", { req: true }),
          c("peContact", "Contact Details of Principal Employer", { req: true }),
          c("state", "Work Location (State)", { req: true, input: "select", options: STATES }),
          c("district", "Work Location (District)", { req: true, suggestFrom: "state", placeholder: "Pick from the list or type" }),
          c("remarks", "Remarks"),
          // CR-5: optional here, so the first Edit does not ask for them
          c("nature", "Nature of Work", { input: "select", options: NATURE_OF_WORK }),
          c("areaOp", "Area of Operation", { input: "select", options: AREA_OF_OPERATION }),
          c("svName", "Name of the supervisor / Auth. Personnel representing the contractor"),
          c("svPhone", "Contact Number of the Supervisor / Auth. Personnel representing the contractor"),
        ],
      },
      ...wageConfigBlocks(),
      { id: "actions", type: "buttons", title: "Buttons", items: [c("submit", "Submit")] },
    ],
  },

  // ----- Workmen -----
  {
    id: "wm_engage", title: "Engage Workmen against Work Order", blocks: [
      {
        id: "select", type: "filter", title: "Select Work Order:", items: [
          c("wo", "Work Order", { input: "select", options: [] }),
          c("showEngaged", "Also show workmen engaged on other work orders (to move them)", { input: "checkbox" }),
        ],
      },
      {
        id: "list", type: "table", title: "List of Workmen", note: "Note: Select a work order from the above dropdown, tick the checkboxes against workmen listed below, select New engagement from date, and click \"Engage Selected\" button at the bottom for engaging checked workmen to selected work order. Workmen already on the selected work order show as Engaged; free workmen can be ticked. Tick \"Also show workmen engaged on other work orders\" to move someone.", items: [
          c("select", "Select", { locked: true }),
          c("newFrom", "New Engagement From"),
          c("fullName", "Full Name"),
          c("wuin", "WUIN", { locked: true }),
          c("dob", "Date of Birth"),
          c("gender", "Gender"),
          c("category", "Category"),
          c("designation", "Designation"),
          c("lastAtt", "Last Attendance Date"),
          c("engFrom", "Engagement From"),
          c("engagedIn", "Engaged in (Work Order)"),
          c("letter", "Appointment Letter", { kind: "action", btn: "View / Upload", upload: true }),
        ],
      },
      {
        id: "actions", type: "buttons", title: "Buttons", items: [
          c("engage", "Engage Selected"), c("newWorkman", "New Workman", { to: "wm_edit" }), c("formA", "FORM A"), c("excel", "Download Excel", { tone: "green" }),
        ],
      },
    ],
  },
  {
    id: "wm_active", title: "Active Workmen", blocks: [
      { id: "top", type: "buttons", title: "Top buttons", align: "right", items: [c("bulkAcc", "Bulk Accommodation", { tone: "outline", hint: "Set the Accommodation (Self / Company Quarter / Contractors' camp) of many workmen at once" })] },
      { id: "list", type: "table", title: "Workmen list", items: WORKMEN_LIST.map((x) => (x.id === "action" ? { ...x, to: "wm_edit" } : x)) },
    ],
  },
  {
    id: "wm_inactive", title: "Inactive Workmen", blocks: [
      { id: "top", type: "buttons", title: "Top buttons", align: "right", items: [c("bulkAcc", "Bulk Accommodation", { tone: "outline", hint: "Set the Accommodation (Self / Company Quarter / Contractors' camp) of many workmen at once" })] },
      { id: "list", type: "table", title: "Workmen list", items: WORKMEN_LIST.map((x) => (x.id === "action" ? { ...x, to: "wm_edit" } : x)) },
    ],
  },
  {
    id: "wm_moved", title: "Workmen Moved Out", blocks: [
      {
        id: "list", type: "table", title: "Moved-out list", items: [
          c("sl", "Sl#", { locked: true }), c("wuin", "WUIN", { locked: true }), c("uid", "ID"), c("fullName", "Full Name"), c("dob", "Date of Birth"),
          c("gender", "Gender"), c("skill", "Skill Category"), c("designation", "Designation"), c("from", "Worked From"),
          c("to", "Worked To"), c("engBefore", "Engagement Before Moving Out", { kind: "action", btn: "Manage Engagements" }),
        ],
      },
    ],
  },
  {
    // CR-2: a workman with his engagements (which work order, when) and wages (which month, how much)
    id: "wm_view", title: "Workman —", hiddenFromMenu: true, blocks: [
      {
        id: "details", type: "kv", title: "Workman details", items: [
          c("wuin", "WUIN"), c("fullName", "Name"), c("status", "Status"), c("skill", "Skill Category"), c("designation", "Designation"),
          c("doj", "Date of Joining"), c("mobile", "Mobile No"), c("accommodation", "Accommodation"), c("engagedIn", "Engaged in (Work Order)"),
          c("exitDate", "Date of Exit"),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("edit", "Edit Workman", { to: "wm_edit" }), c("engage", "Engage on a Work Order", { to: "wm_engage" }), c("delete", "Delete Workman", { tone: "danger" })] },
      {
        id: "engagements", type: "table", title: "Engagements", items: [
          c("woNo", "Work Order Number"), c("workName", "Name of the Work"), c("from", "Engaged From"), c("to", "Engaged To"), c("status", "Status"),
          c("edit", "Edit Dates", { kind: "action", btn: "Edit" }), c("end", "End Engagement", { kind: "action", btn: "End" }),
          c("del", "Delete", { kind: "action", btn: "Delete", danger: true }),
        ],
      },
      {
        id: "wages", type: "table", title: "Wages", items: [
          c("period", "Period"), c("woNo", "Work Order Number"), c("attDays", "Days Worked"), c("gross", "Gross (₹)"),
          c("totalDed", "Deductions (₹)"), c("net", "Net (₹)"), c("wageStatus", "Wage Status"),
          c("slip", "Wage Slip", { kind: "action", btn: "View Slip", to: "wage_slip" }),
        ],
      },
    ],
  },
  {
    id: "wm_edit", title: "Edit Workmen - WUIN : ——", hiddenFromMenu: true, blocks: [
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: Fields marked * are mandatory."), c("n2", "Note: Leave WUIN blank to get the next number automatically. Every field, Aadhaar included, can be corrected later.")] },
      {
        id: "details", type: "form", title: "Workman Details", items: [
          c("wuin", "WUIN"),
          c("aadhaar", "Aadhaar", { req: true, locked: true }),
          c("name", "Name", { req: true }),
          c("surname", "Surname"),
          c("gender", "Gender", { req: true, input: "select", options: ["Male", "Female", "Others"] }),
          c("relative", "Father's/Mother's/Spouse Name", { req: true }),
          c("dob", "Date of Birth", { req: true, input: "date" }),
          c("nationality", "Nationality", { req: true, input: "select", options: ["Indian", "Other"] }),
          c("education", "Education Level"),
          c("doj", "Date of Joining", { req: true, input: "date" }),
          c("designation", "Designation", { req: true }),
          c("skill", "Skill Category", { req: true, input: "select", options: ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"] }),
          c("empType", "Type of Employment"),
          c("mobile", "Mobile No"),
          c("pfType", "PF Type", { req: true, input: "select", options: ["CMPF", "EPF"] }),
          c("uan", "UAN(EPF)/CMPF No"),
          c("gis", "Group Insurance Number"),
          c("pan", "PAN"),
          c("esic", "ESIC IP"),
          c("bankAc", "Bank A/C Number", { req: true }),
          c("bank", "Bank"),
          c("ifsc", "Branch (IFSC)"),
          c("presentAddr", "Address", { req: true, input: "textarea" }),
          c("exitDate", "Date of Exit", { input: "date" }),
          c("idMark", "Mark of Identification"),
          c("pwd", "Person With Disability", { req: true, input: "select", options: ["Yes", "No"] }),
          c("disability", "Disability Details"),
          c("religion", "Select Religion", { input: "select", options: ["Hinduism", "Islam", "Christianity", "Sikhism", "Buddhism", "Jainism", "Other"] }),
          c("exServ", "Ex-Servicemen", { req: true, input: "select", options: ["Yes", "No"] }),
          c("accommodation", "Accommodation", { req: true, input: "select", options: ACCOMMODATION }),
          c("wageCat", "Wage Category", { input: "select", options: ["HPC", "Minimum Wages", "DGR", "Other"] }),
        ],
      },
      {
        id: "nominee", type: "form", title: "Nominee Details", items: [
          c("name", "Nominee Name"), c("relation", "Nominee Relationship"),
          c("dob", "Nominee DOB", { input: "date" }), c("aadhaar", "Nominee Aadhaar No"),
        ],
      },
      {
        id: "emergency", type: "form", title: "Emergency Contact Details", items: [
          c("nameRel", "Emergency Contact Name/Relationship"), c("address", "Emergency Contact Address"), c("phone", "Emergency Contact Number"),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("update", "Update", { wide: true })] },
    ],
  },

  
  // ----- Attendance entry: one number per workman -----

  // ----- Wage entry: calculated from attendance -----
  {
    id: "wage_entry", title: "Wage Entry", hiddenFromMenu: true, blocks: [
      // CR-2: pick the work order (of the selected firm) and month; the grid lists the workmen engaged on it then
      {
        id: "select", type: "filter", title: "Select Work Order and Period:", items: [
          c("wo", "Work Order", { input: "select", options: [] }),
          c("year", "Year", { input: "select", options: ["2021", "2022", "2023", "2024", "2025", "2026", "2027"] }),
          c("month", "Month", { input: "select", options: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] }),
        ],
      },
      {
        id: "header", type: "kv", title: "Entry header", items: [
          c("woRef", "Work Order Reference No", { locked: true }),
          c("period", "Period", { locked: true }),
        ],
      },
      {
        id: "notes", type: "notes", title: "Notes", items: [
          c("n1", "Note: Enter the number of days each workman worked this month (and overtime, if any). Wages and deductions are calculated instantly using this work order's Config."),
          c("n2", "Note: Columns marked auto cannot be typed in. Allowances and other deductions are optional."),
        ],
      },
      { id: "deadline", type: "banner", title: "Deadline banner", tone: "danger", items: [c("text", "Wage submission deadline: ——. After the deadline you may continue saving, but submission is no longer available.")] },
      {
        id: "grid", type: "table", title: "Wage grid", live: "wages", items: [
          c("wuin", "WUIN", { locked: true }),
          c("name", "Name"),
          c("attDays", "Days Worked", { locked: true, input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("otHrs", "OT Hrs", { input: "number", feeds: ["OT", "Gross Earnings", "Net Earnings"] }),
          c("otMin", "OT Min", { input: "select", options: ["0", "15", "30", "45"], feeds: ["OT", "Gross Earnings", "Net Earnings"] }),
          c("basic", "Basic Rate", { auto: true, calc: "Per Day Wage from the work order Config (by Skill Category)", feeds: ["Gross Earnings", "EPF/CMPF Deduction", "Net Earnings"] }),
          c("vda", "VDA Rate", { auto: true, calc: "VDA per Day from the work order Config", feeds: ["Gross Earnings", "EPF/CMPF Deduction", "Net Earnings"] }),
          c("basicPay", "Basic + VDA Earned", { locked: true, auto: true, calc: "(Basic Rate + VDA Rate) × Days Worked" }),
          c("ot", "OT", { auto: true, calc: "(Basic + VDA) ÷ hours per day × OT rate × OT hours", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("ug", "UG Allowance", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("bonus", "Bonus", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("edlis", "EDLIS", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("pli", "PLI", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("otherEarn", "Other Earnings", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("gross", "Gross Earnings", { locked: true, auto: true, calc: "Basic + VDA Earned + OT + UG Allowance + Bonus + EDLIS + PLI + Other Earnings" }),
          c("epf", "EPF/CMPF Deduction", { auto: true, feeds: ["Total Deduction", "Net Earnings"], calc: "EPF % from Config × Basic + VDA Earned (capped at the ceiling, if set)" }),
          c("cmps", "CMPS Deduction", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("esi", "ESI Deduction", { auto: true, feeds: ["Total Deduction", "Net Earnings"], calc: "ESI % from Config × Gross, when gross is within the ESI limit" }),
          c("fine", "Fine", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("otherDed", "Other Deduction", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("damage", "Damage Recovery", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("totalDed", "Total Deduction", { locked: true, auto: true, calc: "EPF/CMPF + CMPS + ESI + Fine + Damage Recovery + Other Deduction" }),
          c("net", "Net Earnings", { locked: true, auto: true, calc: "Gross Earnings − Total Deduction" }),
          c("slip", "Get Wage Slip", { kind: "action", btn: "Download" }),
        ],
      },
      {
        id: "actions", type: "buttons", title: "Buttons", items: [
          c("save", "Save"), c("submit", "Submit"), c("approve", "Approve", { tone: "green" }), c("reopen", "Reopen for Editing", { tone: "outline" }), c("deleteMonth", "Delete Month", { tone: "danger" }), c("excel", "Download Excel", { tone: "green" }), c("statement", "View Wage Statement"),
        ],
      },
    ],
  },

  // ----- Wages -----
  {
    id: "wage_new", title: "New Wage Entry", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, ...PERIOD_STATUS, c("action", "Action", { kind: "action", btn: "Wage Entry", to: "wage_entry" })] },
    ],
  },
  {
    id: "wage_submitted", title: "Submitted Wages", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, ...PERIOD_STATUS, c("action", "Action", { kind: "action", btn: "View", to: "wage_entry" }), c("proof", "Proof of Wage & PF", { kind: "action", btn: "Upload", upload: true }), c("approve", "Approve", { kind: "action", btn: "Approve" })] },
    ],
  },
  {
    id: "wage_approved", title: "Approved Wages", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, ...PERIOD_STATUS, c("action", "Action", { kind: "action", btn: "View", to: "wage_entry" }), c("proof", "Proof of Wage & PF", { kind: "action", btn: "Upload", upload: true })] },
    ],
  },
  {
    id: "wage_slip", title: "Worker Wage Slip", blocks: [
      { id: "search", type: "filter", title: "Search Worker by Unique Number (WUIN)", items: [c("wuin", "WUIN", { input: "text" }), c("search", "Search", { input: "button" })] },
      // CR-2: the worker's months, and the slip of the chosen month
      {
        id: "history", type: "table", title: "Wage months", items: [
          c("period", "Period"), c("woNo", "Work Order Number"), c("attDays", "Days Worked"), c("gross", "Gross (₹)"),
          c("totalDed", "Deductions (₹)"), c("net", "Net (₹)"), c("wageStatus", "Wage Status"), c("view", "Slip", { kind: "action", btn: "View Slip" }),
        ],
      },
      {
        id: "slip", type: "kv", title: "Wage slip", items: [
          c("wuin", "WUIN"), c("name", "Name"), c("woNo", "Work Order Number"), c("period", "Period"), c("attDays", "Days Worked"),
          c("otTime", "Overtime"), c("basic", "Basic Rate (per day)"), c("vda", "VDA Rate (per day)"), c("basicPay", "Basic + VDA Earned"),
          c("ot", "OT"), c("ug", "UG Allowance"), c("bonus", "Bonus"), c("edlis", "EDLIS"), c("pli", "PLI"), c("otherEarn", "Other Earnings"),
          c("gross", "Gross Earnings"), c("epf", "EPF/CMPF Deduction"), c("cmps", "CMPS Deduction"), c("esi", "ESI Deduction"), c("fine", "Fine"), c("otherDed", "Other Deduction"),
          c("damage", "Damage Recovery"), c("totalDed", "Total Deduction"), c("net", "Net Earnings"),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("print", "Print Wage Slip")] },
    ],
  },

  // ----- Profile -----
  {
    id: "create_firm", title: "Create Firm", hiddenFromMenu: true, blocks: [
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: Each firm keeps its own work orders, workmen, wages and bills. Switch firms from the top bar."), c("n2", "Note: Fields marked * are mandatory.")] },
      {
        id: "form", type: "form", title: "Firm Details", items: [
          c("name", "Firm Name", { req: true }),
          c("cuin", "CUIN"),
          c("regNo", "Firm Registration No"),
          c("gstin", "GSTIN No"),
          c("pan", "PAN No"),
          c("pfReg", "PF Registration No"),
          c("esic", "ESIC No"),
          c("mobile", "Mobile No"),
          c("email", "Email ID"),
          c("state", "State", { input: "select", options: STATES }),
          c("address", "Address", { input: "textarea" }),
          c("pincode", "Pincode"),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("save", "Create Firm"), c("delete", "Delete Firm", { tone: "danger" })] },
    ],
  },
  {
    id: "wo_config", title: "Work Order Config", hiddenFromMenu: true, blocks: [
      {
        id: "header", type: "kv", title: "Work order header", items: [
          c("woNo", "Work Order Number", { locked: true }),
          c("workName", "Name of the Work", { locked: true }),
          c("firm", "Firm", { locked: true }),
        ],
      },
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: Changes apply to months not yet submitted. Submitted months keep the values they were calculated with.")] },
      ...wageConfigBlocks(),
      { id: "actions", type: "buttons", title: "Buttons", items: [c("save", "Save Config")] },
    ],
  },
  {
    // CR-2: the firm's bills as a list; Edit / New Bill opens the form below (the firm is the one in the top bar)
    id: "dispatch_register", title: "Dispatch Register", blocks: [
      {
        id: "list", type: "table", title: "Bills", items: [
          c("sl", "Sl#"), c("billNo", "Bill Number"), c("billDate", "Bill Date"), c("woNo", "Work Order Number"), c("partyName", "Party Name / Contract Number"),
          c("taxable", "Taxable Amount"), c("tax", "Tax Amount"), c("gst", "GST Amount"), c("total", "Total Amount"), c("received", "Received Amount"),
          c("gstStatus", "GST"), c("epfStatus", "EPF"), c("esicStatus", "ESIC"), c("approved", "Approved"),
          c("edit", "Edit", { kind: "action", btn: "Edit" }),
        ],
      },
      {
        id: "details", type: "form", title: "Bill Details", items: [
          c("wo", "Work Order", { input: "select", options: [] }),
          c("partyName", "Party Name / Contract Number", { req: true }), c("billNo", "Bill Number", { req: true }), c("billDate", "Bill Date", { req: true, input: "date" }),
          c("taxable", "Taxable Amount", { req: true, input: "number" }),
          c("taxRate", "Tax Rate (%)", { input: "rate", options: TAX_RATES }), c("taxAmount", "Tax Amount", { calc: "tax" }),
          c("gstRate", "GST Rate (%)", { input: "rate", options: TAX_RATES }), c("gst", "GST Amount", { calc: "gst" }),
          c("total", "Total Amount", { calc: "total" }),
          c("received", "Received Amount", { input: "number" }),
          c("receivedDate", "Received Date", { input: "date" }), c("deduction", "Deduction", { input: "number" }), c("remark", "Remark"),
          c("gstStatus", "GST Payment Status against Bill", { input: "select", options: PAYMENT_STATUS }),
          c("epfStatus", "EPF Payment Status", { input: "select", options: PAYMENT_STATUS }), c("esicStatus", "ESIC payment Status", { input: "select", options: PAYMENT_STATUS }),
          c("approved", "Approved", { locked: true, input: "select", options: ["No", "Yes"] }), c("approvedBy", "Approved By", { locked: true }),
          c("approvalDate", "Approval Date", { locked: true, input: "date" }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("edit", "Save Bill"), c("new", "New Bill", { tone: "outline" }), c("delete", "Delete Bill", { tone: "danger" })] },
    ],
  },
  {
    id: "reset_pw", title: "Reset Password", blocks: [
      {
        id: "form", type: "form", title: "Password", single: true, items: [
          c("current", "Current Password", { req: true, input: "password" }),
          c("new", "New Password", { req: true, input: "password" }),
          c("confirm", "Confirm New Password", { req: true, input: "password" }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("submit", "Submit")] },
    ],
  },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s]));

// ---------- field formats (lib/validate.js) ----------
// Every typed field of every form has a format: what may be typed, how long it may be, and the pattern it must
// match. The screens apply it while typing and when leaving the field; lib/ops.js applies it again on save.
// Select, date-picker and file fields need none (their options are fixed). tests/unit/spec.test.js fails if a
// typed field is missing here.
export const FIELD_FORMATS = {
  "create_firm.form": {
    name: "text", cuin: "code", regNo: "code", gstin: "gstin", pan: "pan", pfReg: "code", esic: "esicCode",
    mobile: "mobile", email: "email", address: "longText", pincode: "pincode",
  },
  "wo_new.form": {
    woNo: "code", partyGst: "gstin", workName: "longText", peName: "text", start: "date", peDesig: "text", end: "date",
    peAddr: "longText", company: "text", peContact: "contact", district: "place", remarks: "longText",
    svName: "personName", svPhone: "mobile",
  },
  "wo_edit.form": {
    woNo: "code", partyGst: "gstin", workName: "longText", company: "text", start: "date", end: "date", peContact: "contact",
    peName: "text", svName: "personName", peDesig: "text", svPhone: "mobile", peAddr: "longText", svPhone2: "mobile",
    svEmail: "email", district: "place", svEmail2: "email", remarks: "longText",
  },
  "*.statutory": {
    epfPercent: "percent", epfWageCeiling: "money", esiPercent: "percent", esiGrossCeiling: "money",
    otMultiplier: "decimal", hoursPerDay: "int", deadlineDay: "int",
  },
  "*.rates": { basicDaily: "positiveMoney", vdaDaily: "money" },
  "wm_edit.details": {
    wuin: "code", aadhaar: "aadhaar", name: "personName", surname: "personName", relative: "personName", dob: "date",
    education: "text", doj: "date", designation: "text", empType: "text", mobile: "mobile", uan: "uan", gis: "code",
    pan: "pan", esic: "esicIp", bankAc: "bankAc", bank: "text", ifsc: "ifsc", presentAddr: "longText", exitDate: "date",
    idMark: "text", disability: "text",
  },
  "wm_edit.nominee": { name: "personName", relation: "personName", dob: "date", aadhaar: "aadhaar" },
  "wm_edit.emergency": { nameRel: "text", address: "longText", phone: "mobile" },
  "dispatch_register.details": {
    partyName: "text", billNo: "code", billDate: "date", taxable: "money", taxRate: "percent", gstRate: "percent", received: "money",
    receivedDate: "date", deduction: "money", remark: "longText", approvedBy: "personName", approvalDate: "date",
  },
  "reset_pw.form": { current: "password", new: "password", confirm: "password" },
  "wage_slip.search": { wuin: "code" },
};
const WIDTHS = { "create_firm.form.cuin": 32, "create_firm.form.pfReg": 32, "wm_edit.details.wuin": 32, "wm_edit.details.gis": 30 };
for (const s of SCREENS) {
  for (const b of s.blocks) {
    const map = FIELD_FORMATS[`${s.id}.${b.id}`] ?? FIELD_FORMATS[`*.${b.id}`];
    if (!map) continue;
    for (const it of b.items) {
      if (map[it.id]) it.format = map[it.id];
      if (WIDTHS[`${s.id}.${b.id}.${it.id}`]) it.maxLength = WIDTHS[`${s.id}.${b.id}.${it.id}`];
    }
  }
}
/** The field definition (label, req, format…) of a form field. */
export const fieldOf = (screenId, block, item) => SCREEN_BY_ID[screenId]?.blocks.find((b) => b.id === block)?.items.find((i) => i.id === item);
