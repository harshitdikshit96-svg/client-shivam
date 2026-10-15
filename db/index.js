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
    return drizzle(new Pool({ connectionString: url, max: 10 }), { schema: fullSchema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = url?.startsWith("pglite:") ? url.slice("pglite:".length) : "./.data/pglite";
  return drizzle(new PGlite(dir), { schema: fullSchema });
}

export { fullSchema as schema };
