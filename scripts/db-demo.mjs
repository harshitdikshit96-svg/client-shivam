// Load dummy data through the real code, print a report, and check every rule.
//   npm run db:migrate && npm run db:demo        then wipe with:  npm run db:reset -- --yes
// Re-running replaces earlier demo data; it refuses if any non-demo firm exists.
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { firms } from "../db/schema.js";
import { loadDemoData, runDemoChecks, demoSummary } from "../lib/demo.js";

const db = await getDb();
const existing = await db.select({ name: firms.name, cuin: firms.cuin }).from(firms);
if (existing.some((f) => !f.cuin?.startsWith("DEMO-"))) {
  console.error("The database has real (non-demo) firms, so demo data was not loaded. To wipe everything: npm run db:reset -- --yes");
  process.exit(1);
}
if (existing.length) {
  // only a previous demo run is here: clear firm data (the login in app_users is kept) and load again
  await db.execute(sql`TRUNCATE firms RESTART IDENTITY CASCADE`);
  console.log(`Removed the previous demo data (${existing.length} firms); loading it again.`);
}
const ids = await loadDemoData(db);
const checks = await runDemoChecks(db, ids);
const { counts, wageLines } = await demoSummary(db);

console.log("\nRows loaded:"); console.table(counts);
console.log("Wage lines (calculated from days typed + each order's Config):"); console.table(wageLines);
console.log("Checks:");
console.table(checks.map((c) => ({ result: c.ok ? "PASS" : "FAIL", rule: c.rule, detail: c.detail })));
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${checks.length} checks passed. Wipe the demo data with: npm run db:reset -- --yes`);
process.exit(failed ? 1 : 0);
