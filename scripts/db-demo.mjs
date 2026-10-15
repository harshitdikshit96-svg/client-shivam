// Load dummy data through the real code, print a report, and check every rule.
//   npm run db:migrate && npm run db:demo        then wipe with:  npm run db:reset -- --yes
import { getDb } from "../db/index.js";
import { firms } from "../db/schema.js";
import { loadDemoData, runDemoChecks, demoSummary } from "../lib/demo.js";

const db = await getDb();
if ((await db.select().from(firms)).length) {
  console.error("The database already has data. Run `npm run db:reset -- --yes` first (demo data goes into an empty database only).");
  process.exit(1);
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
