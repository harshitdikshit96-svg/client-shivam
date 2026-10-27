// Request checks shared by the API routes.
import { NextResponse } from "next/server";

const MAX_BODY = 512 * 1024;   // the largest real request (a full wage grid) is a few KB

/**
 * Requests that change data must come from this site's own pages, as JSON (CSRF defence on top of the SameSite
 * cookie): a browser always sends Origin on a cross-site POST, and a plain HTML form cannot send application/json.
 * Returns a NextResponse to send back when the request is refused, else null.
 */
export function refuseCrossSite(req) {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = (process.env.TRUST_PROXY === "true" && req.headers.get("x-forwarded-host")) || req.headers.get("host");
    let ok = false;
    try { ok = new URL(origin).host === host; } catch { /* malformed Origin */ }
    if (!ok) return NextResponse.json({ error: "This request did not come from the portal's own pages." }, { status: 403 });
  }
  if (req.method !== "DELETE" && !(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Requests must be sent as JSON." }, { status: 415 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ error: "The request is too large." }, { status: 413 });
  }
  return null;
}

/**
 * A database fault as a message for the screen (details stay in the server log).
 * 42P01 = a table is missing: the database was never migrated.
 */
export function databaseFault(e, where) {
  console.error(where, e);
  const code = e?.code ?? e?.cause?.code;
  const setup = code === "42P01";
  return NextResponse.json({
    error: setup
      ? "The database has not been set up yet (its tables are missing). Run `npm run db:migrate` against it, then `npm run db:login` — see docs/DEPLOY.md."
      : "The server could not read the database. Please try again in a minute; if it keeps happening, check the server logs.",
    setup,
  }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

/**
 * The caller's address for slowing down password guessing. X-Forwarded-For can be typed by anyone, so it is only
 * believed behind a proxy that sets it (TRUST_PROXY=true). Without one, all callers share one counter.
 */
export function clientAddress(req) {
  if (process.env.TRUST_PROXY === "true") {
    return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "proxy";
  }
  return "direct";
}

/** The field-selection prototype's endpoints exist only in prototype mode. */
export const prototypeOnly = () =>
  (process.env.NEXT_PUBLIC_APP_MODE === "prototype" ? null : NextResponse.json({ error: "Not found" }, { status: 404 }));
