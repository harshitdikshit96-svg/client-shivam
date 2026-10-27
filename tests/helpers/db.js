// A fresh, migrated, in-memory PostgreSQL (PGlite) per test file — no server, no Docker.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { schema } from "@/db/index";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // a plain path: under jsdom (UI tests) the global URL is jsdom's, which node:url does not accept
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return { db, client, close: () => client.close() };
}
