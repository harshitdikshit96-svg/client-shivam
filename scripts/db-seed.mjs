// Seed the single login, firm settings and statutory rates. Safe to run more than once.
//   ADMIN_USERNAME=owner ADMIN_PASSWORD='long-password' npm run db:seed
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { appUsers, firmSettings, statutoryRates } from "../db/schema.js";

const db = await getDb();
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

await db.insert(firmSettings).values({ id: 1 }).onConflictDoNothing();
// Baseline statutory rates — confirm with the client's CA; add a new row (new effective date) when rules change.
await db.insert(statutoryRates)
  .values({ effectiveFrom: "2020-01-01", epfPercent: "12", epfWageCeiling: null, esiPercent: "0.75", esiGrossCeiling: "21000" })
  .onConflictDoNothing();

if (username && password) {
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  await db.insert(appUsers).values({ username, passwordHash: await bcrypt.hash(password, 12) })
    .onConflictDoUpdate({ target: appUsers.username, set: { passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`login "${username}" ready`);
} else {
  console.log("ADMIN_USERNAME / ADMIN_PASSWORD not set — login not created");
}
console.log("seed done");
process.exit(0);
