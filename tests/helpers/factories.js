// Test data builders. Every call returns a valid row; pass overrides for what the test cares about.
import {
  workOrders, workmen, engagements, monthlySheets, attendanceEntries, wageRates, statutoryRates,
} from "@/db/schema";

let n = 0;
const seq = () => ++n;

export async function makeWorkOrder(db, over = {}) {
  const i = seq();
  const [row] = await db.insert(workOrders).values({
    woNumber: `GEMC-TEST-${i}`, nameOfWork: "Sweeping and cleaning", company: "NEC",
    principalEmployerName: "Principal Employer", principalEmployerDesignation: "Area Manager",
    principalEmployerContact: "9000000000", state: "Assam", district: "Tinsukia",
    commencementDate: "2026-06-15", completionDate: "2026-10-30", status: "approved", ...over,
  }).returning();
  return row;
}

export async function makeWorkman(db, over = {}) {
  const i = seq();
  const [row] = await db.insert(workmen).values({
    wuin: `W${100000 + i}`, aadhaar: String(100000000000 + i), name: `Worker ${i}`, gender: "Male",
    relativeName: "Parent", dateOfBirth: "1990-01-01", dateOfJoining: "2026-07-14", designation: "LABOUR",
    skillCategory: "Unskilled", pfType: "EPF", bankAccountNo: "000011112222", address: "Margherita",
    accommodation: "Self", ...over,
  }).returning();
  return row;
}

export async function engage(db, workmanId, workOrderId, over = {}) {
  const [row] = await db.insert(engagements).values({ workmanId, workOrderId, engagedFrom: "2026-07-14", ...over }).returning();
  return row;
}

export async function makeSheet(db, workOrderId, over = {}) {
  const [row] = await db.insert(monthlySheets).values({ workOrderId, year: 2026, month: 8, ...over }).returning();
  return row;
}

export async function recordAttendance(db, sheetId, workmanId, over = {}) {
  const [row] = await db.insert(attendanceEntries).values({ sheetId, workmanId, daysWorked: "26", ...over }).returning();
  return row;
}

export async function seedRates(db, { basicDaily = "556", vdaDaily = "0", effectiveFrom = "2026-04-01", skillCategory = "Unskilled" } = {}) {
  const [stat] = await db.insert(statutoryRates).values({ effectiveFrom: "2020-01-01" }).onConflictDoNothing().returning();
  const [rate] = await db.insert(wageRates).values({ skillCategory, basicDaily, vdaDaily, effectiveFrom }).returning();
  return { stat, rate };
}
