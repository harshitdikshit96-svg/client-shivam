// Relations for Drizzle's query API (db.query.workOrders.findMany({ with: { config: true, rates: true } }), etc.)
import { relations } from "drizzle-orm";
import {
  firms, workOrders, workOrderConfig, workOrderRates, workmen, engagements, monthlySheets, wageLines, dispatchRegister,
} from "./schema.js";

export const firmsRelations = relations(firms, ({ many }) => ({
  workOrders: many(workOrders),
  workmen: many(workmen),
  bills: many(dispatchRegister),
}));
export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  firm: one(firms, { fields: [workOrders.firmId], references: [firms.id] }),
  config: one(workOrderConfig, { fields: [workOrders.id], references: [workOrderConfig.workOrderId] }),
  rates: many(workOrderRates),
  engagements: many(engagements),
  sheets: many(monthlySheets),
  bills: many(dispatchRegister),
}));
export const workOrderConfigRelations = relations(workOrderConfig, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderConfig.workOrderId], references: [workOrders.id] }),
}));
export const workOrderRatesRelations = relations(workOrderRates, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderRates.workOrderId], references: [workOrders.id] }),
}));
export const workmenRelations = relations(workmen, ({ one, many }) => ({
  firm: one(firms, { fields: [workmen.firmId], references: [firms.id] }),
  engagements: many(engagements),
  wageLines: many(wageLines),
}));
export const engagementsRelations = relations(engagements, ({ one }) => ({
  workman: one(workmen, { fields: [engagements.workmanId], references: [workmen.id] }),
  workOrder: one(workOrders, { fields: [engagements.workOrderId], references: [workOrders.id] }),
}));
export const monthlySheetsRelations = relations(monthlySheets, ({ one, many }) => ({
  workOrder: one(workOrders, { fields: [monthlySheets.workOrderId], references: [workOrders.id] }),
  wageLines: many(wageLines),
}));
export const wageLinesRelations = relations(wageLines, ({ one }) => ({
  sheet: one(monthlySheets, { fields: [wageLines.sheetId], references: [monthlySheets.id] }),
  workman: one(workmen, { fields: [wageLines.workmanId], references: [workmen.id] }),
}));
export const dispatchRegisterRelations = relations(dispatchRegister, ({ one }) => ({
  firm: one(firms, { fields: [dispatchRegister.firmId], references: [firms.id] }),
  workOrder: one(workOrders, { fields: [dispatchRegister.workOrderId], references: [workOrders.id] }),
}));
