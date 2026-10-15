// Relations for Drizzle's query API (db.query.workOrders.findMany({ with: { engagements: true } }), etc.)
import { relations } from "drizzle-orm";
import {
  workOrders, workmen, engagements, monthlySheets, attendanceEntries, wageLines, wageRates, statutoryRates, dispatchRegister,
} from "./schema.js";

export const workOrdersRelations = relations(workOrders, ({ many }) => ({
  engagements: many(engagements),
  sheets: many(monthlySheets),
  bills: many(dispatchRegister),
}));
export const workmenRelations = relations(workmen, ({ many }) => ({
  engagements: many(engagements),
  attendance: many(attendanceEntries),
  wageLines: many(wageLines),
}));
export const engagementsRelations = relations(engagements, ({ one }) => ({
  workman: one(workmen, { fields: [engagements.workmanId], references: [workmen.id] }),
  workOrder: one(workOrders, { fields: [engagements.workOrderId], references: [workOrders.id] }),
}));
export const monthlySheetsRelations = relations(monthlySheets, ({ one, many }) => ({
  workOrder: one(workOrders, { fields: [monthlySheets.workOrderId], references: [workOrders.id] }),
  attendance: many(attendanceEntries),
  wageLines: many(wageLines),
}));
export const attendanceEntriesRelations = relations(attendanceEntries, ({ one }) => ({
  sheet: one(monthlySheets, { fields: [attendanceEntries.sheetId], references: [monthlySheets.id] }),
  workman: one(workmen, { fields: [attendanceEntries.workmanId], references: [workmen.id] }),
}));
export const wageLinesRelations = relations(wageLines, ({ one }) => ({
  sheet: one(monthlySheets, { fields: [wageLines.sheetId], references: [monthlySheets.id] }),
  workman: one(workmen, { fields: [wageLines.workmanId], references: [workmen.id] }),
  wageRate: one(wageRates, { fields: [wageLines.wageRateId], references: [wageRates.id] }),
  statutoryRate: one(statutoryRates, { fields: [wageLines.statutoryRateId], references: [statutoryRates.id] }),
}));
export const dispatchRegisterRelations = relations(dispatchRegister, ({ one }) => ({
  workOrder: one(workOrders, { fields: [dispatchRegister.workOrderId], references: [workOrders.id] }),
}));
