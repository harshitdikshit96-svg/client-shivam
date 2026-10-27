// Database connection.
//   DATABASE_URL=postgres://user:pass@host:5432/db  -> PostgreSQL via node-postgres (production / VPS)
//   DATABASE_URL unset or "pglite:./.data/pglite"   -> embedded PGlite (local development, no server needed)
import * as schema from "./schema.js";
import * as relations from "./relations.js";

const fullSchema = { ...schema, ...relations };
let dbPromise;

export function getDb() {
  if (!dbPromise) dbPromise = connect(process.env.DATABASE_URL);
  return dbPromise;
}

async function connect(url) {
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    // idle connections are closed after 10 s, so serverless instances (Vercel) do not hold them open
    return drizzle(new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 10000 }), { schema: fullSchema });
  }
  if (process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE)) {
    // the embedded database is for local development only (it writes to ./.data and is not installed on servers)
    throw new Error("DATABASE_URL is not set to a postgres:// address. Set it in the server's environment variables (Vercel: Project → Settings → Environment Variables).");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = url?.startsWith("pglite:") ? url.slice("pglite:".length) : "./.data/pglite";
  if (dir !== "memory://") {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true }); // first run on a fresh checkout: the folder doesn't exist yet
  }
  return drizzle(new PGlite(dir), { schema: fullSchema });
}

export { fullSchema as schema };
