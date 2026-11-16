import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/index";
import { dumpAll, countsOf } from "@/lib/backup";
import { saveBackup } from "@/lib/backup-store";

export const dynamic = "force-dynamic";

// GET /api/cron/backup — the daily backup (vercel.json → crons). Vercel calls it with "Authorization: Bearer $CRON_SECRET";
// anything else is refused, and without CRON_SECRET set it never runs.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Backups are not set up: CRON_SECRET is missing." }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    const dump = await dumpAll(await getDb());
    const saved = await saveBackup(dump);
    console.log(`backup ${saved.name}: ${saved.size} bytes to ${saved.place}; removed ${saved.removed.join(", ") || "none"}`);
    return NextResponse.json({ ...saved, rows: countsOf(dump) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("backup failed", e);
    return NextResponse.json({ error: "The backup failed; see the function logs." }, { status: 500 });
  }
}
