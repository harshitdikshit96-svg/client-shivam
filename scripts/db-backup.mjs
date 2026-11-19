// Backups by hand (the daily one runs on Vercel: /api/cron/backup). Uses DATABASE_URL and BACKUP_BLOB_READ_WRITE_TOKEN
// like the app; without the token, backups are files in ./.data/backups.
//   npm run db:backup                         take a backup now (today's file; the oldest beyond 21 is deleted)
//   npm run db:backup -- --list               list the backups kept, newest first
//   npm run db:backup -- --download 15/11/2026 [--out file.json]   save one to a file
//   npm run db:backup -- --to-file file.json  take a backup into a file only (nothing stored, nothing deleted)
//   npm run db:backup -- --restore 15/11/2026 --yes        replace ALL data with that day's backup
//   npm run db:backup -- --restore-file file.json --yes    …or with a backup file
import { promises as fs } from "node:fs";
import { getDb } from "../db/index.js";
import { dumpAll, restoreAll, countsOf, checkDump } from "../lib/backup.js";
import { saveBackup, listBackups, readBackup, backupPlace, dmy, dmyTime } from "../lib/backup-store.js";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const where = /^postgres/.test(process.env.DATABASE_URL ?? "") ? `the database at ${new URL(process.env.DATABASE_URL).host}` : "the local database";
const rows = (c) => Object.entries(c).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(", ") || "no rows";

try {
  if (args.includes("--list")) {
    const all = await listBackups();
    console.log(`${all.length} backup(s) in ${backupPlace()}:`);
    for (const b of all) console.log(`  ${dmy(b.day)}  ${(b.size / 1024).toFixed(1)} KB  saved ${dmyTime(b.savedAt)}`);
  } else if (opt("--download")) {
    const dump = await readBackup(opt("--download"));
    const out = opt("--out") ?? `erp-${opt("--download").replace(/^erp-|\.json$/g, "")}.json`;
    await fs.writeFile(out, JSON.stringify(dump, null, 1), { mode: 0o600 });
    console.log(`Saved ${out} (${rows(countsOf(dump))}). It holds Aadhaar and bank details: keep it private.`);
  } else if (opt("--to-file")) {
    const dump = await dumpAll(await getDb());
    await fs.writeFile(opt("--to-file"), JSON.stringify(dump, null, 1), { mode: 0o600 });
    console.log(`Backed up ${where} to ${opt("--to-file")}: ${rows(countsOf(dump))}.`);
  } else if (opt("--restore") || opt("--restore-file")) {
    const dump = opt("--restore") ? await readBackup(opt("--restore")) : JSON.parse(await fs.readFile(opt("--restore-file"), "utf8"));
    checkDump(dump);
    if (!args.includes("--yes")) {
      console.error(`This replaces ALL data in ${where} with the backup of ${dmyTime(dump.takenAt)} (${rows(countsOf(dump))}). Re-run with --yes.`);
      process.exit(1);
    }
    console.log(`Restored ${where} from the backup of ${dmyTime(dump.takenAt)}: ${rows(await restoreAll(await getDb(), dump))}. Everyone has to log in again.`);
  } else {
    const dump = await dumpAll(await getDb());
    const s = await saveBackup(dump);
    console.log(`Backed up ${where} as ${s.name} in ${s.place}: ${rows(countsOf(dump))}.${s.removed.length ? ` Deleted the oldest: ${s.removed.join(", ")}.` : ""}`);
  }
  process.exit(0);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
