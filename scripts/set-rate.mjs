// Add a wage rate (maintenance task when minimum wages / VDA are revised).
//   npm run rates:set -- --skill "Unskilled" --basic 556 --vda 0 --from 2026-04-01
import { getDb } from "../db/index.js";
import { wageRates } from "../db/schema.js";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const row = { skillCategory: arg("skill"), basicDaily: arg("basic"), vdaDaily: arg("vda") ?? "0", effectiveFrom: arg("from") };
if (!row.skillCategory || !row.basicDaily || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom ?? "")) {
  console.error('usage: npm run rates:set -- --skill "Unskilled" --basic 556 --vda 0 --from 2026-04-01');
  process.exit(1);
}
const db = await getDb();
const [saved] = await db.insert(wageRates).values(row).returning();
console.log("saved", saved);
process.exit(0);
