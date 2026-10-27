// Seed the single login and the first firm. Safe to run more than once.
//   ADMIN_USERNAME=owner ADMIN_PASSWORD='long-password' npm run db:seed
// (To change only the login later: npm run db:login)
import { getDb } from "../db/index.js";
import { firms } from "../db/schema.js";
import { setLogin } from "../lib/session.js";

const db = await getDb();
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

await db.insert(firms).values({ name: "Secure Eye Security and Manpower Suppliers" }).onConflictDoNothing();

if (username && password) {
  try {
    console.log(`login "${(await setLogin(db, { username, password })).username}" ready`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else {
  console.log("ADMIN_USERNAME / ADMIN_PASSWORD not set — login not created");
}
console.log("seed done");
process.exit(0);
