// Wipe ALL data and rebuild empty tables from the migrations.
//   npm run db:reset -- --yes          (refuses without --yes; refuses in production without --force)
import { sql } from "drizzle-orm";
import { getDb } from "../db/index.js";

if (!process.argv.includes("--yes")) {
  console.error("This deletes every firm, work order, workman and wage record. Re-run with:  npm run db:reset -- --yes");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("NODE_ENV=production: add --force if you really mean to wipe the live database.");
  process.exit(1);
}
const db = await getDb();
await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);
const { migrate } = /^postgres/.test(process.env.DATABASE_URL ?? "")
  ? await import("drizzle-orm/node-postgres/migrator")
  : await import("drizzle-orm/pglite/migrator");
await migrate(db, { migrationsFolder: "./drizzle" });
const { rows } = await db.execute(sql`SELECT count(*)::int AS n FROM firms`);
console.log(`Database reset: tables rebuilt, ${rows?.[0]?.n ?? 0} firms. Run npm run db:seed to create the login again.`);
process.exit(0);
