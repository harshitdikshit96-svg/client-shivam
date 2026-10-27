// What the screens read (/api/data): one firm with its records linked to each other.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers/db";
import { loadDemoData } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";

let t, a, b;
beforeAll(async () => {
  t = await createTestDb();
  const ids = await loadDemoData(t.db);
  a = await firmSnapshot(t.db, ids.firms[0].id);
  b = await firmSnapshot(t.db, ids.firms[1].id);
});
afterAll(async () => { await t.close(); });

describe("firm snapshot", () => {
  it("lists both firms and keeps each firm's rows separate", () => {
    expect(a.firms).toHaveLength(2);
    const ids = (s) => s.workmen.map((w) => w.id);
    expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([]);
    expect(b.workOrders.every((o) => o.firm === b.firm.name)).toBe(true);
  });

  it("does not send Aadhaar or bank details with the lists", () => {
    const w = a.workmen[0];
    expect(w).not.toHaveProperty("aadhaar");
    expect(w).not.toHaveProperty("bankAccountNo");
  });

  it("links every engagement, wage line and bill to its work order and workman", () => {
    const orderIds = new Set(a.workOrders.map((o) => o.id));
    const workmanIds = new Set(a.workmen.map((w) => w.id));
    for (const e of a.engagements) { expect(orderIds.has(e.workOrderId)).toBe(true); expect(workmanIds.has(e.workmanId)).toBe(true); }
    for (const s of a.sheets) for (const l of s.lines) expect(workmanIds.has(l.workmanId)).toBe(true);
    for (const x of a.bills) expect(x.workOrderId == null || orderIds.has(x.workOrderId)).toBe(true);
    const w1 = a.workmen.find((w) => w.wuin === "DEMO-W01");
    expect(w1).toMatchObject({ engagedIn: "DEMO-WO-001", engagedWoId: a.workOrders.find((o) => o.woNo === "DEMO-WO-001").id, state: "active" });
  });

  it("counts the workmen currently engaged on each work order", () => {
    expect(Object.fromEntries(a.workOrders.map((o) => [o.woNo, o.workmenCount]))).toMatchObject({ "DEMO-WO-001": 4, "DEMO-WO-002": 2, "DEMO-WO-005": 0 });
  });

  it("carries the client's August CLIP line through to the wage grid", () => {
    const aug = a.sheets.find((s) => s.month === 8 && s.woNo === "DEMO-WO-001");
    expect(aug.lines.find((l) => l.attDays === 26)).toMatchObject({ basic: 556, gross: 14456, epf: 1735, esi: 108, net: 12613 });
    expect(aug.net).toBeCloseTo(aug.lines.reduce((t2, l) => t2 + l.net, 0));
  });

  it("sends each work order's Config so Wage Entry can calculate while typing", () => {
    const wo1 = a.workOrders.find((o) => o.woNo === "DEMO-WO-001");
    expect(wo1.config).toMatchObject({ hoursPerDay: 8, deadlineDay: 20, rates: { Unskilled: { basicDaily: 600 }, "Semi Skilled": { basicDaily: 620 } } });
  });
});
