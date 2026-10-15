// Apply SQL migrations in ./drizzle to DATABASE_URL (Postgres) or local PGlite.
import { getDb } from "../db/index.js";

const db = await getDb();
const url = process.env.DATABASE_URL ?? "";
const { migrate } = /^postgres/.test(url)
  ? await import("drizzle-orm/node-postgres/migrator")
  : await import("drizzle-orm/pglite/migrator");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
process.exit(0);
