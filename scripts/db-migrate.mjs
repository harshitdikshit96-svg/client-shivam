// Apply SQL migrations in ./drizzle to DATABASE_URL (Postgres) or local PGlite.
// Neon: migrations use the direct address (DATABASE_URL_UNPOOLED) when it is set, not the connection pooler.
//
//   node scripts/db-migrate.mjs            local / by hand (see docs/DEPLOY.md)
//   node scripts/db-migrate.mjs --deploy   Vercel build step (vercel.json): needs a postgres:// address; without one a
//                                          Production build fails, a Preview build skips the migrations with a warning
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//.test(url);

if (process.argv.includes("--deploy") && !isPostgres) {
  const env = process.env.VERCEL_ENV ?? "unknown";
  if (env === "production") {
    console.error("db-migrate: DATABASE_URL is not set to a postgres:// address for Production. Connect Neon to this project (Vercel → Storage) or add DATABASE_URL, then redeploy.");
    process.exit(1);
  }
  console.warn(`db-migrate: no postgres:// DATABASE_URL in this ${env} build, so migrations were skipped. This deployment will show "database not set up".`);
  process.exit(0);
}

const { getDb } = await import("../db/index.js");
const db = await getDb();
const { migrate } = isPostgres
  ? await import("drizzle-orm/node-postgres/migrator")
  : await import("drizzle-orm/pglite/migrator");
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} catch (e) {
  console.error("db-migrate: migrations failed, nothing after the failing file was applied.\n", e);
  process.exit(1);
}
const where = isPostgres ? new URL(url).host : "local PGlite";
console.log(`migrations applied (${where})`);
process.exit(0);
