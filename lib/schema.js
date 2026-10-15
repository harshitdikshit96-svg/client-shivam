// Single source of truth for every screen of the prototype.
// Every menu item, block, column, field and button has a stable id.
// Ids are scoped per screen: "<screen>.<block>.<item>", so hiding a column on one
// screen never affects another, even when screens share a column set.
//
// Item flags:
//   locked:   true  -> cannot be hidden (system / read-only / calculated fields)
//   readOnly: true  -> rendered as a read-only input
//   req:      true  -> shown with a red * (no restriction on hiding)
//   calc:     "..." -> calculated column; the text describes the formula
//   feeds:    [...] -> hiding it asks for confirmation, naming these calculated outputs

export const APP_TITLE = "Contractor Portal";

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

// ---------- menu ----------
export const MENU = [
  {
    id: "wo", label: "Work Order", items: [
      { id: "ongoing", label: "Ongoing Work Order", screen: "wo_ongoing" },
      { id: "completed", label: "Completed Work Order", screen: "wo_completed" },
      { id: "pending", label: "Pending Work Order Approval", screen: "wo_pending" },
    ],
  },
  { id: "home", label: "Home", screen: "home", locked: true },
  {
    id: "workmen", label: "Workmen", items: [
      { id: "engage", label: "Engage Workmen Against Work Order", screen: "wm_engage" },
      { id: "active", label: "View Active Workmen", screen: "wm_active" },
      { id: "inactive", label: "View Inactive Workmen", screen: "wm_inactive" },
      { id: "photo", label: "Workmen Photo", screen: "wm_photo" },
      { id: "moved", label: "Workmen Moved Out", screen: "wm_moved" },
    ],
  },
  // Attendance has no menu of its own in the client's spec (v1): it is reached from New Wage Entry.
  {
    id: "wages", label: "Wages", items: [
      { id: "new", label: "New Wage Entry", screen: "wage_new" },
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
      {
        id: "stats", type: "stats", title: "Summary cards", items: [
          c("pending", "Pending Work Order Approvals"),
          c("approved", "Approved Work Orders"),
          c("rejected", "Rejected Work Orders"),
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
          c("s3", "Step 3: Mark Attendance — Attendance → New Attendance. Save attendance for workmen engaged in the period, then submit after verification."),
          c("s4", "Step 4: Wage Entry — available under New Wage Entry after attendance submission. Verify and submit wage details."),
          c("imp", "Important: ensure workmen engagement is correct, attendance is submitted before wage entry, and all mandatory workman fields are filled."),
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
          c("update", "Update Work Order", { kind: "action", btn: "Edit", to: "wo_edit" }),
          c("engage", "Workmen Engagement", { kind: "action", btn: "Engage", to: "wm_engage" }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("create", "Create New Work Order", { to: "wo_new" })] },
    ],
  },
  { id: "wo_completed", title: "Completed Work Orders / Contracts", blocks: [{ id: "list", type: "table", title: "Work order list", items: WO_LIST }] },
  { id: "wo_pending", title: "Approval Pending Work Orders / Contracts", blocks: [{ id: "list", type: "table", title: "Work order list", items: WO_LIST }] },
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
          c("peName", "Name of the Principal Employer", { req: true, readOnly: true, locked: true }),
          c("svName", "Name of the supervisor / Auth. Personnel representing the contractor", { req: true }),
          c("peDesig", "Designation of the Principal Employer", { req: true, readOnly: true, locked: true }),
          c("svPhone", "Contact Number of the Supervisor / Auth. Personnel representing the contractor", { req: true }),
          c("peAddr", "Address of the Principal Employer", { readOnly: true, locked: true, input: "textarea" }),
          c("svPhone2", "Alternate Contact Number of the Supervisor / Auth. Personnel representing the contractor"),
          c("state", "Work Location (State)", { req: true, input: "select", options: STATES }),
          c("svEmail", "Email Address of the Supervisor / Auth. Personnel representing the contractor"),
          c("district", "Work Location (District)", { req: true }),
          c("svEmail2", "Alternate Email Address of the Supervisor / Auth. Personnel representing the contractor"),
          c("nature", "Nature of Work", { req: true, input: "select", options: NATURE_OF_WORK }),
          c("license", "Upload Labour License [ PDF file less than 1MB]", { input: "file" }),
          c("areaOp", "Area of Operation", { req: true, input: "select", options: AREA_OF_OPERATION }),
          c("remarks", "Remarks"),
        ],
      },
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
          c("district", "Work Location (District)", { req: true }),
          c("remarks", "Remarks"),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("submit", "Submit")] },
    ],
  },

  // ----- Workmen -----
  {
    id: "wm_engage", title: "Engage Workmen against Work Order", blocks: [
      { id: "select", type: "filter", title: "Select Work Order:", items: [c("wo", "Work Order", { input: "select", options: ["— select work order —"] })] },
      {
        id: "list", type: "table", title: "List of Workmen", note: "Note: Select a work order from the above dropdown, tick the checkboxes against workmen listed below, select New engagement from date, and click \"Engage Selected\" button at the bottom for engaging checked workmen to selected work order.", items: [
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
          c("letter", "Appointment Letter", { kind: "action", btn: "View / Upload" }),
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
      { id: "top", type: "buttons", title: "Top buttons", align: "right", items: [c("bulkAcc", "Bulk Accommodation", { tone: "outline" })] },
      { id: "list", type: "table", title: "Workmen list", items: WORKMEN_LIST.map((x) => (x.id === "action" ? { ...x, to: "wm_edit" } : x)) },
    ],
  },
  {
    id: "wm_inactive", title: "Inactive Workmen", blocks: [
      { id: "top", type: "buttons", title: "Top buttons", align: "right", items: [c("bulkAcc", "Bulk Accommodation", { tone: "outline" })] },
      { id: "list", type: "table", title: "Workmen list", items: WORKMEN_LIST.map((x) => (x.id === "action" ? { ...x, to: "wm_edit" } : x)) },
    ],
  },
  {
    id: "wm_photo", title: "Workmen Photo", blocks: [
      {
        id: "list", type: "table", title: "Workmen photo list", items: [
          c("sl", "Sl#", { locked: true }), c("wuin", "WUIN", { locked: true }), c("name", "Name"), c("surname", "Surname"),
          c("dob", "Date of Birth"), c("gender", "Gender"), c("skill", "Skill Category"), c("designation", "Designation"),
          c("photo", "Photo"), c("upload", "Upload", { kind: "action", btn: "Photo Upload" }),
        ],
      },
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
    id: "wm_edit", title: "Edit Workmen - WUIN : ——", hiddenFromMenu: true, blocks: [
      { id: "note", type: "notes", title: "Notes", items: [c("n1", "Note: Fields marked * are mandatory."), c("n2", "Note: Aadhaar is not editable.")] },
      {
        id: "details", type: "form", title: "Workman Details", items: [
          c("aadhaar", "Aadhaar", { req: true, readOnly: true, locked: true }),
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
          c("accommodation", "Accommodation", { req: true, input: "select", options: ["Self", "Company Quarter", "Contractors' camp"] }),
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

  // ----- Attendance -----
  {
    id: "att_new", title: "New Attendance", blocks: [
      periodFilter(),
      {
        id: "list", type: "table", title: "Work order list", items: [
          ...PERIOD_LIST.map((x) => (x.id === "workName" ? { ...x, label: "Name of the Worker" } : x)),
          c("action", "Action", { kind: "action", btn: "Attendance", to: "att_entry" }),
        ],
      },
    ],
  },
  { id: "att_submitted", title: "Submitted Attendance", blocks: [periodFilter(), { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, c("action", "Action", { kind: "action", btn: "View" })] }] },
  { id: "att_approved", title: "Approved Attendance", blocks: [periodFilter(), { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, c("action", "Action", { kind: "action", btn: "View" })] }] },

  // ----- Attendance entry: one number per workman -----
  {
    id: "att_entry", title: "Attendance Entry", hiddenFromMenu: true, blocks: [
      {
        id: "header", type: "kv", title: "Entry header", items: [
          c("woRef", "Work Order Reference No", { locked: true }),
          c("period", "Period", { locked: true }),
        ],
      },
      {
        id: "notes", type: "notes", title: "Notes", items: [
          c("n1", "Note: Enter the number of days each workman worked in this month. Wages are calculated automatically from it in the Wages section."),
        ],
      },
      {
        id: "grid", type: "table", title: "Attendance grid", items: [
          c("sl", "Sl#", { locked: true }),
          c("wuin", "WUIN", { locked: true }),
          c("name", "Workman"),
          c("designation", "Designation"),
          c("skill", "Skill Category"),
          c("attDays", "Days Worked (this month)", { locked: true, input: "number" }),
          c("otHrs", "OT Hrs", { input: "number", feeds: ["OT", "Gross Earnings", "Net Earnings"] }),
          c("otMin", "OT Min", { input: "select", options: ["0", "15", "30", "45"], feeds: ["OT", "Gross Earnings", "Net Earnings"] }),
          c("remarks", "Remarks"),
        ],
      },
      {
        id: "actions", type: "buttons", title: "Buttons", items: [
          c("save", "Save"), c("excel", "Download Excel", { tone: "green" }), c("submit", "Submit"),
        ],
      },
    ],
  },

  // ----- Wage entry: calculated from attendance -----
  {
    id: "wage_entry", title: "Wage Entry", hiddenFromMenu: true, blocks: [
      {
        id: "header", type: "kv", title: "Entry header", items: [
          c("woRef", "Work Order Reference No", { locked: true }),
          c("period", "Period", { locked: true }),
        ],
      },
      {
        id: "notes", type: "notes", title: "Notes", items: [
          c("n1", "Note: Days Worked comes from the Attendance section and cannot be changed here."),
          c("n2", "Note: Earnings, deductions and Net Earnings are calculated automatically. Only the optional allowance and deduction columns can be entered."),
        ],
      },
      { id: "deadline", type: "banner", title: "Deadline banner", tone: "danger", items: [c("text", "Wage submission deadline: ——. After the deadline you may continue saving, but submission is no longer available.")] },
      {
        id: "grid", type: "table", title: "Wage grid", items: [
          c("wuin", "WUIN", { locked: true }),
          c("name", "Name"),
          c("attDays", "Days Worked", { locked: true, auto: true, calc: "From Attendance Entry" }),
          c("basic", "Basic Rate", { auto: true, calc: "Daily rate from rate master (by Skill Category)", feeds: ["Gross Earnings", "EPF/CMPF Deduction", "Net Earnings"] }),
          c("vda", "VDA Rate", { auto: true, calc: "Daily VDA from rate master", feeds: ["Gross Earnings", "EPF/CMPF Deduction", "Net Earnings"] }),
          c("basicPay", "Basic + VDA Earned", { locked: true, auto: true, calc: "(Basic Rate + VDA Rate) × Days Worked" }),
          c("ot", "OT", { auto: true, calc: "OT Hrs/Min from Attendance × OT rate", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("ug", "UG Allowance", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("bonus", "Bonus", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("edlis", "EDLIS", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("pli", "PLI", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("otherEarn", "Other Earnings", { input: "number", feeds: ["Gross Earnings", "Net Earnings"] }),
          c("gross", "Gross Earnings", { locked: true, auto: true, calc: "Basic + VDA Earned + OT + UG Allowance + Bonus + EDLIS + PLI + Other Earnings" }),
          c("epf", "EPF/CMPF Deduction", { auto: true, feeds: ["Total Deduction", "Net Earnings"], calc: "12% of Basic + VDA Earned" }),
          c("esi", "ESI Deduction", { auto: true, feeds: ["Total Deduction", "Net Earnings"], calc: "0.75% of Gross Earnings" }),
          c("otherDed", "Other Deduction", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("damage", "Damage Recovery", { input: "number", feeds: ["Total Deduction", "Net Earnings"] }),
          c("totalDed", "Total Deduction", { locked: true, auto: true, calc: "EPF/CMPF + ESI + Other Deduction + Damage Recovery" }),
          c("net", "Net Earnings", { locked: true, auto: true, calc: "Gross Earnings − Total Deduction" }),
          c("slip", "Get Wage Slip", { kind: "action", btn: "Download" }),
        ],
      },
      {
        id: "actions", type: "buttons", title: "Buttons", items: [
          c("save", "Save"), c("submit", "Submit"), c("excel", "Download Excel", { tone: "green" }), c("statement", "View Wage Statement"),
        ],
      },
    ],
  },

  // ----- Wages -----
  {
    id: "wage_new", title: "New Wage Entry", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, c("action", "Action", { kind: "action", btn: "Wage Entry", to: "wage_entry" })] },
    ],
  },
  {
    id: "wage_submitted", title: "Submitted Wages", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, c("action", "Action", { kind: "action", btn: "View" }), c("proof", "Proof of Wage & PF", { kind: "action", btn: "Upload" })] },
    ],
  },
  {
    id: "wage_approved", title: "Approved Wages", blocks: [
      periodFilter(),
      { id: "list", type: "table", title: "Work order list", items: [...PERIOD_LIST, c("action", "Action", { kind: "action", btn: "View" }), c("proof", "Proof of Wage & PF", { kind: "action", btn: "Upload" })] },
    ],
  },
  {
    id: "wage_slip", title: "Worker Wage Slip", blocks: [
      { id: "search", type: "filter", title: "Search Worker by Unique Number (WUIN)", items: [c("wuin", "WUIN", { input: "text" }), c("search", "Search", { input: "button" })] },
    ],
  },

  // ----- Profile -----
  {
    id: "dispatch_register", title: "Dispatch Register", blocks: [
      {
        id: "details", type: "kv", title: "Select Firm", items: [
          c("partyName", "Party Name / Contract Number"), c("billNo", "Bill Number"), c("billDate", "Bill Date"),
          c("taxable", "Taxable Amount"), c("gst", "GST Amount"), c("received", "Received Amount"), c("receivedDate", "Received Date"),
          c("deduction", "Deduction"), c("remark", "Remark"), c("gstStatus", "GST Payment Status against Bill"),
          c("epfStatus", "EPF Payment Status"), c("esicStatus", "ESIC payment Status"),
          c("approved", "Approved", { locked: true }), c("approvedBy", "Approved By", { locked: true }), c("approvalDate", "Approval Date", { locked: true }),
        ],
      },
      { id: "actions", type: "buttons", title: "Buttons", items: [c("edit", "Edit")] },
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
