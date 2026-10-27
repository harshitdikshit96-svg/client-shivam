// Apply SQL migrations in ./drizzle to DATABASE_URL (Postgres) or local PGlite.
// Neon: migrations use the direct address (DATABASE_URL_UNPOOLED) when it is set, not the connection pooler.
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const { getDb } = await import("../db/index.js");

const db = await getDb();
const url = process.env.DATABASE_URL ?? "";
const { migrate } = /^postgres/.test(url)
  ? await import("drizzle-orm/node-postgres/migrator")
  : await import("drizzle-orm/pglite/migrator");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations applied");
process.exit(0);
