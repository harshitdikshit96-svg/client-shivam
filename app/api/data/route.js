import { NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { firmSnapshot } from "@/lib/data";
import { OPS, UserError, explainDbError } from "@/lib/ops";
import { SESSION_COOKIE, sessionUser, endOtherSessions } from "@/lib/session";
import { refuseCrossSite } from "@/lib/http";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
// every data call needs a logged-in session; 401 tells the screen to show the login page
const LOGGED_OUT = { error: "You have been logged out. Please log in again.", loggedOut: true };

// GET /api/data?firm=ID — everything the screens show for one firm (the first firm when ID is missing).
export async function GET(req) {
  const firmId = Number(new URL(req.url).searchParams.get("firm")) || null;
  try {
    const db = await getDb();
    if (!(await sessionUser(db, req.cookies.get(SESSION_COOKIE)?.value))) return NextResponse.json(LOGGED_OUT, { status: 401 });
    return NextResponse.json(await firmSnapshot(db, firmId), { headers: noStore });
  } catch (e) {
    console.error("GET /api/data", e);
    return NextResponse.json({ error: "Could not read the database. Has `npm run db:migrate` been run?" }, { status: 500 });
  }
}

// POST /api/data { op, firmId, ...args } — one operation from lib/ops.js.
// 400 { error, fields, fix } for anything the user can correct; 500 only for real faults.
export async function POST(req) {
  const refused = refuseCrossSite(req);
  if (refused) return refused;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "The request could not be read." }, { status: 400 }); }
  const fn = Object.hasOwn(OPS, body?.op ?? "") ? OPS[body.op] : null;   // only real operations, never Object.prototype keys
  if (!fn) return NextResponse.json({ error: `Unknown action "${body?.op}".` }, { status: 400 });
  try {
    const db = await getDb();
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const user = await sessionUser(db, token);
    if (!user) return NextResponse.json(LOGGED_OUT, { status: 401 });
    const result = await db.transaction((tx) => fn(tx, { ...body, firmId: Number(body.firmId) || null }));
    // a new password logs out every other browser; this one stays logged in
    if (body.op === "resetPassword") await endOtherSessions(db, user.id, token);
    return NextResponse.json({ result }, { headers: noStore });
  } catch (e) {
    const user = e instanceof UserError ? e : explainDbError(e);
    if (user) return NextResponse.json({ error: user.message, fields: user.fields, fix: user.fix }, { status: 400 });
    console.error(`POST /api/data ${body.op}`, e);
    return NextResponse.json({ error: "Something went wrong while saving. Nothing was changed; please try again." }, { status: 500 });
  }
}
