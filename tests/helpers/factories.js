// Test data builders. Every call returns a valid row; pass overrides for what the test cares about.
import {
  firms, workOrders, workOrderConfig, workOrderRates, workmen, engagements, monthlySheets,
} from "@/db/schema";

let n = 0;
const seq = () => ++n;

export async function makeFirm(db, over = {}) {
  const [row] = await db.insert(firms).values({ name: `Firm ${seq()}`, ...over }).returning();
  return row;
}

export async function makeWorkOrder(db, firmId, over = {}) {
  const i = seq();
  const [row] = await db.insert(workOrders).values({
    firmId, woNumber: `GEMC-TEST-${i}`, nameOfWork: "Sweeping and cleaning", company: "NEC",
    principalEmployerName: "Principal Employer", principalEmployerDesignation: "Area Manager",
    principalEmployerContact: "9000000000", state: "Assam", district: "Tinsukia",
    commencementDate: "2026-06-15", completionDate: "2026-10-30", status: "approved", ...over,
  }).returning();
  return row;
}

/** The work order's Config: deductions/OT settings + per-day wage by skill (default: Unskilled ₹556). */
export async function configure(db, workOrderId, { config = {}, rates = { Unskilled: { basicDaily: "556" } } } = {}) {
  await db.insert(workOrderConfig).values({ workOrderId, ...config });
  for (const [skillCategory, r] of Object.entries(rates)) {
    await db.insert(workOrderRates).values({ workOrderId, skillCategory, ...r });
  }
}

export async function makeWorkman(db, firmId, over = {}) {
  const i = seq();
  const [row] = await db.insert(workmen).values({
    firmId, wuin: `W${100000 + i}`, aadhaar: String(100000000000 + i), name: `Worker ${i}`, gender: "Male",
    relativeName: "Parent", dateOfBirth: "1990-01-01", dateOfJoining: "2026-07-14", designation: "LABOUR",
    skillCategory: "Unskilled", pfType: "EPF", bankAccountNo: "000011112222", address: "Margherita",
    accommodation: "Self", ...over,
  }).returning();
  return row;
}

export async function engage(db, workman, workOrder, over = {}) {
  const [row] = await db.insert(engagements).values({
    firmId: workOrder.firmId, workmanId: workman.id, workOrderId: workOrder.id, engagedFrom: "2026-07-14", ...over,
  }).returning();
  return row;
}

export async function makeSheet(db, workOrderId, over = {}) {
  const [row] = await db.insert(monthlySheets).values({ workOrderId, year: 2026, month: 8, ...over }).returning();
  return row;
}
