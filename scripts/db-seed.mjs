// Seed the single login and the first firm. Safe to run more than once.
//   ADMIN_USERNAME=owner ADMIN_PASSWORD='long-password' npm run db:seed
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { appUsers, firms } from "../db/schema.js";

const db = await getDb();
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

await db.insert(firms).values({ name: "Secure Eye Security and Manpower Suppliers" }).onConflictDoNothing();

if (username && password) {
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(appUsers).values({ username, passwordHash })
    .onConflictDoUpdate({ target: appUsers.username, set: { passwordHash } });
  console.log(`login "${username}" ready`);
} else {
  console.log("ADMIN_USERNAME / ADMIN_PASSWORD not set — login not created");
}
console.log("seed done");
process.exit(0);
