// The dummy-data run (npm run db:demo) as a test: every check must pass on a fresh database,
// and every list screen of the demo firm has something to show.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers/db";
import { loadDemoData, runDemoChecks, demoSummary } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";

let t, checks, summary, snap;
beforeAll(async () => {
  t = await createTestDb();
  const ids = await loadDemoData(t.db);
  checks = await runDemoChecks(t.db, ids);
  summary = await demoSummary(t.db);
  snap = await firmSnapshot(t.db, ids.firms[0].id);
});
afterAll(async () => { await t.close(); });

describe("demo data", () => {
  it("loads 2 firms, 7 orders, 11 workers, 17 wage lines, 4 bills", () => {
    expect(summary.counts).toMatchObject({ firms: 2, workOrders: 7, workmen: 11, engagements: 10, monthlySheets: 7, wageLines: 17, bills: 4 });
  });
  it("passes every check", () => {
    const failed = checks.filter((c) => !c.ok).map((c) => `${c.rule}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(20);
  });
  it("fills every list of the first firm", () => {
    const statuses = new Set(snap.workOrders.map((o) => o.status));
    expect([...statuses].sort()).toEqual(["approved", "completed", "pending", "rejected"]);
    expect(new Set(snap.workmen.map((w) => w.state))).toEqual(new Set(["active", "inactive", "moved"]));
    expect(new Set(snap.sheets.map((s) => s.status))).toEqual(new Set(["draft", "submitted", "approved"]));
    expect(snap.bills.length).toBeGreaterThanOrEqual(3);
    expect(snap.activity.length).toBeGreaterThan(0);
  });
});
