// Business rules that can be tightened or relaxed without touching code elsewhere.
// Defaults keep the data clean but never lock anything: every field stays editable unless listed in
// lockedAfterCreate. The database itself only enforces structure (ids, links, one sheet per month, money ≥ 0…).
export const RULES = {
  // Form fields that become read-only once the record is saved, as "<block>.<field>" of lib/schema.js.
  // Empty = everything stays editable. Example: { wm_edit: ["details.aadhaar"] } locks Aadhaar after onboarding.
  lockedAfterCreate: {},

  // Aadhaar
  aadhaarRequired: true,          // a workman cannot be saved without one
  aadhaarUniquePerFirm: true,     // the same Aadhaar twice in one firm is refused (names the existing WUIN)

  // Format checks on typed values: Aadhaar 12 digits, mobile 10 digits, pincode 6, PAN, GSTIN, IFSC, email
  checkFormats: true,

  // Workmen: youngest age on the date of joining (0 switches the check off)
  minimumAge: 18,

  // Engagements
  engagementWithinOrderDates: true,   // engagement start must fall inside the work order's dates
  engagementAfterJoining: true,       // …and not before the workman's date of joining

  // Wages: days paid on an order ≤ days engaged on it that month, and ≤ the month's days across all orders
  wageDaysWithinEngagement: true,

  // Wages: a submitted / approved month is locked until someone presses "Reopen for Editing"
  allowReopenWages: true,
};

/** Is this form field read-only for an existing record? */
export const isLockedAfterCreate = (screenId, block, item) => (RULES.lockedAfterCreate[screenId] ?? []).includes(`${block}.${item}`);
