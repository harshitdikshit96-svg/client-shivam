// Daily backups: the whole database to JSON and back (lib/backup.js), and the 21-day store (lib/backup-store.js).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import { loadDemoData } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";
import { OPS } from "@/lib/ops";
import { dumpAll, restoreAll, countsOf, BACKUP_TABLES, NOT_BACKED_UP } from "@/lib/backup";
import { saveBackup, listBackups, readBackup, backupName, KEEP_DAYS } from "@/lib/backup-store";

let t;
let ids;
beforeEach(async () => { t = await createTestDb(); ids = await loadDemoData(t.db); });
afterEach(async () => { await t.close(); });

const snap = async (db = t.db) => firmSnapshot(db, ids.firms[0].id);

describe("dump and restore (lib/backup.js)", () => {
  it("every table of the database is in the backup, except login sessions", async () => {
    const r = await t.db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const all = r.rows.map((x) => x.table_name).sort();
    expect([...BACKUP_TABLES, ...NOT_BACKED_UP].sort()).toEqual(all);
  });
  it("a restore brings back exactly what was backed up: records added since are gone, deleted ones are back", async () => {
    const before = await snap();
    const dump = JSON.parse(JSON.stringify(await dumpAll(t.db)));   // through JSON, as it is stored
    expect(countsOf(dump).workmen).toBeGreaterThan(0);
    await OPS.createFirm(t.db, { values: { form: { name: "Added After Backup" } } });
    await t.db.execute(sql`DELETE FROM dispatch_register`);
    expect((await snap()).bills).toHaveLength(0);
    await restoreAll(t.db, dump);
    expect((await snap()).firms.map((f) => f.name)).not.toContain("Added After Backup");
    const after = await snap();
    expect(after).toEqual(before);   // dates, money, statuses, links: all the same
  });
  it("a backup restored and backed up again is identical, timestamps included (written in UTC)", async () => {
    const dump = JSON.parse(JSON.stringify(await dumpAll(t.db)));
    await restoreAll(t.db, dump);
    expect((await dumpAll(t.db)).tables).toEqual(dump.tables);
    expect(dump.tables.firms[0].created_at).toMatch(/\+00:00$/);
  });
  it("new records after a restore get new ids (the counters continue)", async () => {
    const dump = await dumpAll(t.db);
    await restoreAll(t.db, dump);
    const maxId = Math.max(...dump.tables.firms.map((f) => f.id));
    const f = await OPS.createFirm(t.db, { values: { form: { name: "After Restore" } } });
    expect(f.id).toBe(maxId + 1);
  });
  it("a restore logs everyone out and keeps the login", async () => {
    await t.db.execute(sql`INSERT INTO app_users (username, password_hash) VALUES ('admin', 'x')`);
    const dump = await dumpAll(t.db);
    await t.db.execute(sql`INSERT INTO sessions (user_id, token_hash, expires_at) SELECT id, 'h', now() + interval '1 day' FROM app_users`);
    await restoreAll(t.db, dump);
    expect((await t.db.execute(sql`SELECT count(*)::int AS n FROM sessions`)).rows[0].n).toBe(0);
    expect((await t.db.execute(sql`SELECT username FROM app_users`)).rows).toEqual([{ username: "admin" }]);
  });
  it("refuses a backup from another database version or another app, and then changes nothing", async () => {
    const dump = await dumpAll(t.db);
    const before = await snap();
    await expect(restoreAll(t.db, { ...dump, migrations: dump.migrations - 1 })).rejects.toThrow(/database version/);
    await expect(restoreAll(t.db, { ...dump, app: "other" })).rejects.toThrow(/not a backup of this app/);
    expect(await snap()).toEqual(before);
  });
  it("a restore that fails half-way changes nothing (one transaction)", async () => {
    const dump = await dumpAll(t.db);
    const before = await snap();
    const broken = { ...dump, tables: { ...dump.tables, wage_lines: [{ ...dump.tables.wage_lines[0], sheet_id: 999999 }] } };
    await expect(restoreAll(t.db, broken)).rejects.toThrow();
    expect(await snap()).toEqual(before);
  });
});

describe("the backup store keeps the latest 21 days (lib/backup-store.js, local folder)", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), "erp-backups-")); process.env.BACKUP_DIR = dir; delete process.env.BACKUP_BLOB_READ_WRITE_TOKEN; });
  afterEach(() => { delete process.env.BACKUP_DIR; rmSync(dir, { recursive: true, force: true }); });
  const day = (n) => new Date(Date.UTC(2026, 10, 1, 6) + n * 86400000);   // 1 Nov 2026 + n days, midday in India

  it("names a backup by the date in India", () => {
    expect(backupName(new Date("2026-11-14T20:30:00Z"))).toBe("erp-2026-11-15.json");   // 02:00 IST next day
  });
  it("one file a day; a second backup the same day replaces it", async () => {
    const dump = await dumpAll(t.db);
    await saveBackup(dump, { at: day(0) });
    await saveBackup(dump, { at: day(0) });
    expect(readdirSync(dir)).toEqual(["erp-2026-11-01.json"]);
  });
  it(`after ${KEEP_DAYS} days the oldest backup is deleted each day`, async () => {
    const dump = await dumpAll(t.db);
    let removed = [];
    for (let n = 0; n < KEEP_DAYS + 3; n++) removed = (await saveBackup(dump, { at: day(n) })).removed;
    const kept = await listBackups();
    expect(kept).toHaveLength(KEEP_DAYS);
    expect(kept[0].day).toBe("2026-11-24");                 // newest first
    expect(kept.at(-1).day).toBe("2026-11-04");             // the 3 oldest went
    expect(removed).toEqual(["erp-2026-11-03.json"]);       // one more each day
  });
  it("any kept day can be read back and restored", async () => {
    const before = await snap();
    await saveBackup(await dumpAll(t.db), { at: day(2) });
    await t.db.execute(sql`DELETE FROM dispatch_register`);
    await restoreAll(t.db, await readBackup("2026-11-03"));
    expect(await snap()).toEqual(before);
    await expect(readBackup("2026-10-01")).rejects.toThrow(/no backup erp-2026-10-01.json/);
    await expect(readBackup("../../etc/passwd")).rejects.toThrow(/not a backup name/);
  });
});

describe("the daily backup route (/api/cron/backup) only runs for Vercel Cron", () => {
  const call = async (auth) => {
    const { GET } = await import("@/app/api/cron/backup/route");
    return GET(new Request("http://x/api/cron/backup", auth ? { headers: { authorization: auth } } : {}));
  };
  afterEach(() => { delete process.env.CRON_SECRET; });
  it("never runs without CRON_SECRET set", async () => {
    expect((await call("Bearer anything")).status).toBe(503);
  });
  it("refuses a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret-value-for-test";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("s3cret-value-for-test")).status).toBe(401);
  });
});
