// Where backups are kept: one file per day (India date), the latest KEEP_DAYS kept, older ones deleted.
//   BACKUP_BLOB_READ_WRITE_TOKEN set → a PRIVATE Vercel Blob store (production). Connect the store to the project with
//     the env prefix "BACKUP" so it does not clash with any other Blob store's BLOB_READ_WRITE_TOKEN.
//   not set → ./.data/backups on this computer, or BACKUP_DIR (local development; .data is not committed)
// Backups hold Aadhaar and bank details: never put them in a public store.
import { promises as fs } from "node:fs";
import path from "node:path";

export const KEEP_DAYS = 21;
const PREFIX = "backups/";
const localDir = () => process.env.BACKUP_DIR || path.join(process.cwd(), ".data", "backups");
const NAME = /^erp-(\d{4}-\d{2}-\d{2})\.json$/;

const token = () => process.env.BACKUP_BLOB_READ_WRITE_TOKEN || null;
export const backupPlace = () => (token() ? "Vercel Blob (private)" : localDir());

/** The backup's file name for a moment: erp-YYYY-MM-DD.json, by the date in India. */
export function backupName(at = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return `erp-${day}.json`;
}

/** Every backup kept, newest first: [{ name, day, size, savedAt }] */
export async function listBackups() {
  let files;
  if (token()) {
    const { list } = await import("@vercel/blob");
    files = [];
    let cursor;
    do {
      const r = await list({ prefix: PREFIX, cursor, token: token() });
      for (const b of r.blobs) files.push({ name: b.pathname.slice(PREFIX.length), size: b.size, savedAt: new Date(b.uploadedAt).toISOString() });
      cursor = r.hasMore ? r.cursor : null;
    } while (cursor);
  } else {
    await fs.mkdir(localDir(), { recursive: true });
    files = await Promise.all((await fs.readdir(localDir())).map(async (name) => {
      const st = await fs.stat(path.join(localDir(), name));
      return { name, size: st.size, savedAt: st.mtime.toISOString() };
    }));
  }
  return files.filter((f) => NAME.test(f.name)).map((f) => ({ ...f, day: NAME.exec(f.name)[1] })).sort((a, b) => b.day.localeCompare(a.day));
}

/** Save today's backup (a second one the same day replaces the first), then delete all but the newest KEEP_DAYS. */
export async function saveBackup(dump, { at = new Date(), keep = KEEP_DAYS } = {}) {
  const name = backupName(at);
  const body = JSON.stringify(dump);
  if (token()) {
    const { put } = await import("@vercel/blob");
    await put(PREFIX + name, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", token: token() });
  } else {
    await fs.mkdir(localDir(), { recursive: true });
    await fs.writeFile(path.join(localDir(), name), body, { mode: 0o600 });
  }
  const removed = await pruneBackups(keep);
  return { name, size: Buffer.byteLength(body), place: backupPlace(), removed };
}

/** Keep the newest `keep` backups; the oldest beyond that are deleted. Returns the names deleted. */
export async function pruneBackups(keep = KEEP_DAYS) {
  const old = (await listBackups()).slice(keep).map((f) => f.name);
  if (!old.length) return [];
  if (token()) {
    const { del } = await import("@vercel/blob");
    await del(old.map((n) => PREFIX + n), { token: token() });
  } else {
    await Promise.all(old.map((n) => fs.unlink(path.join(localDir(), n))));
  }
  return old;
}

/** dd/mm/yyyy for people; file names keep year-month-day so they sort by date. */
export const dmy = (iso) => String(iso).slice(0, 10).split("-").reverse().join("/");
/** A moment as dd/mm/yyyy, hh:mm in India. */
export function dmyTime(at) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute} IST`;
}

/** One backup's contents, by file name (erp-YYYY-MM-DD.json) or day (15/11/2026, or 2026-11-15). */
export async function readBackup(nameOrDay) {
  const d = String(nameOrDay).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const day = d ? `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` : nameOrDay;
  const name = NAME.test(day) ? day : `erp-${day}.json`;
  if (!NAME.test(name)) throw new Error(`"${nameOrDay}" is not a backup name; use a day like 15/11/2026.`);
  if (token()) {
    const { get } = await import("@vercel/blob");
    const r = await get(PREFIX + name, { access: "private", useCache: false, token: token() });
    if (!r?.stream) throw new Error(`There is no backup ${name}.`);
    return JSON.parse(await new Response(r.stream).text());
  }
  try {
    return JSON.parse(await fs.readFile(path.join(localDir(), name), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") throw new Error(`There is no backup ${name}.`);
    throw e;
  }
}
