// Backups: the whole database as one JSON document, and back again.
//   dumpAll(db)          → { app, takenAt, migrations, tables: { firms: [rows…], … } }   (sessions are not kept)
//   restoreAll(db, dump) → every table emptied and refilled from the dump, ids continue after the restored ones
// Rows go through Postgres's own JSON (row_to_json / json_populate_recordset), so dates, numbers and money come back
// exactly as stored, on Neon and on the local PGlite alike. Where the backups are kept: lib/backup-store.js.
import { sql } from "drizzle-orm";

export const BACKUP_APP = "contractor-erp";
// parents before children (foreign keys); a restore fills them in this order and empties them in reverse
export const BACKUP_TABLES = [
  "app_users", "firms", "work_orders", "work_order_config", "work_order_rates", "workmen", "engagements",
  "monthly_sheets", "wage_lines", "dispatch_register",
];
// login sessions are not data: a restore logs everyone out
export const NOT_BACKED_UP = ["sessions"];

const rowsOf = (r) => r?.rows ?? r ?? [];

/** How many migrations the database has run: a backup restores only into the same table layout. */
export async function migrationCount(db) {
  const r = await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
  return rowsOf(r)[0]?.n ?? 0;
}

export async function dumpAll(db, { now = new Date() } = {}) {
  // one transaction: every table as of the same moment; times written in UTC whatever the server's zone
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL TIME ZONE 'UTC'`);
    const tables = {};
    for (const t of BACKUP_TABLES) {
      const r = await tx.execute(sql`SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.id), '[]'::json) AS rows FROM ${sql.identifier(t)} t`);
      const v = rowsOf(r)[0]?.rows;
      tables[t] = typeof v === "string" ? JSON.parse(v) : v ?? [];
    }
    return { app: BACKUP_APP, takenAt: now.toISOString(), migrations: await migrationCount(tx), tables };
  });
}

/** Rows per table, for messages: { firms: 2, workmen: 31, … } */
export const countsOf = (dump) => Object.fromEntries(BACKUP_TABLES.map((t) => [t, dump.tables?.[t]?.length ?? 0]));

export function checkDump(dump) {
  if (dump?.app !== BACKUP_APP || !dump.tables || typeof dump.tables !== "object") throw new Error("This file is not a backup of this app.");
  const missing = BACKUP_TABLES.filter((t) => !Array.isArray(dump.tables[t]));
  if (missing.length) throw new Error(`The backup has no ${missing.join(", ")} table.`);
}

/**
 * Replace everything in the database with the backup. Runs in one transaction: on any error nothing changes.
 * Refuses a backup taken with a different number of migrations (the tables would not match).
 */
export async function restoreAll(db, dump) {
  checkDump(dump);
  const here = await migrationCount(db);
  if (dump.migrations !== here) {
    throw new Error(`The backup was taken at database version ${dump.migrations}, this database is at ${here}. Restore it into a database at the same version.`);
  }
  await db.transaction(async (tx) => {
    const all = [...BACKUP_TABLES, ...NOT_BACKED_UP].map((t) => sql.identifier(t));
    await tx.execute(sql`TRUNCATE ${sql.join(all, sql`, `)} RESTART IDENTITY CASCADE`);
    for (const t of BACKUP_TABLES) {
      const rows = dump.tables[t];
      if (rows.length) {
        await tx.execute(sql`INSERT INTO ${sql.identifier(t)} SELECT * FROM json_populate_recordset(NULL::${sql.identifier(t)}, ${JSON.stringify(rows)}::json)`);
      }
      // new records continue after the restored ids
      await tx.execute(sql`SELECT setval(pg_get_serial_sequence(${t}, 'id'), coalesce(max(id), 1), max(id) IS NOT NULL) FROM ${sql.identifier(t)}`);
    }
  });
  return countsOf(dump);
}
