import { NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { UserError } from "@/lib/ops";
import { SESSION_COOKIE, SESSION_DAYS, login, logout, sessionUser, theLogin } from "@/lib/session";
import { refuseCrossSite, clientAddress, databaseFault } from "@/lib/http";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
// Secure cookies need HTTPS; COOKIE_SECURE=false allows a plain-HTTP server (not recommended)
const cookie = { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false" };

// GET — am I logged in? { loggedIn, username, hasLogin }
export async function GET(req) {
  try {
    const db = await getDb();
    const user = await sessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
    return NextResponse.json({ loggedIn: !!user, username: user?.username ?? null, hasLogin: !!(await theLogin(db)) }, { headers: noStore });
  } catch (e) {
    return databaseFault(e, "GET /api/session");
  }
}

// POST { username, password } — log in
export async function POST(req) {
  const refused = refuseCrossSite(req);
  if (refused) return refused;
  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  try {
    const db = await getDb();
    const address = clientAddress(req);
    const { token, user, expiresAt } = await login(db, { username: body.username, password: body.password, address });
    const res = NextResponse.json({ loggedIn: true, username: user.username }, { headers: noStore });
    res.cookies.set(SESSION_COOKIE, token, { ...cookie, expires: expiresAt, maxAge: SESSION_DAYS * 86400 });
    return res;
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message, fields: e.fields }, { status: 400 });
    return databaseFault(e, "POST /api/session");
  }
}

// DELETE — log out (this browser)
export async function DELETE(req) {
  const refused = refuseCrossSite(req);
  if (refused) return refused;
  try {
    await logout(await getDb(), req.cookies.get(SESSION_COOKIE)?.value);
  } catch (e) {
    console.error("DELETE /api/session", e);   // the cookie is cleared anyway; the session row expires on its own
  }
  const res = NextResponse.json({ loggedIn: false }, { headers: noStore });
  res.cookies.set(SESSION_COOKIE, "", { ...cookie, maxAge: 0 });
  return res;
}
