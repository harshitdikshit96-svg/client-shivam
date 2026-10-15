// The dummy-data run (npm run db:demo) as a test: every check must pass on a fresh database.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers/db";
import { loadDemoData, runDemoChecks, demoSummary } from "@/lib/demo";

let t, checks, summary;
beforeAll(async () => {
  t = await createTestDb();
  const ids = await loadDemoData(t.db);
  checks = await runDemoChecks(t.db, ids);
  summary = await demoSummary(t.db);
});
afterAll(async () => { await t.close(); });

describe("demo data", () => {
  it("loads 2 firms, 4 orders, 8 workers, 9 wage lines, 3 bills", () => {
    expect(summary.counts).toMatchObject({ firms: 2, workOrders: 4, workmen: 8, engagements: 8, wageLines: 9, bills: 3 });
  });
  it("passes every check", () => {
    const failed = checks.filter((c) => !c.ok).map((c) => `${c.rule}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(18);
  });
});
