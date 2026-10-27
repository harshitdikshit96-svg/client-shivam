import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/store";
import { isAdmin, isClient } from "@/lib/auth";
import { prototypeOnly } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/config?k=CLIENT_TOKEN  or  ?a=ADMIN_TOKEN
export async function GET(req) {
  const off = prototypeOnly();   // closed unless NEXT_PUBLIC_APP_MODE=prototype
  if (off) return off;
  const { searchParams } = new URL(req.url);
  const admin = isAdmin(searchParams.get("a"));
  if (!admin && !isClient(searchParams.get("k"))) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }
  const state = await readState();
  // the client only needs his current draft; version history is for the review page
  const body = admin ? state : { overrides: state.overrides, status: state.status, updatedAt: state.updatedAt, submittedAt: state.submittedAt, version: (state.history || []).length };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

// PUT { k, overrides } — autosave the client's draft
export async function PUT(req) {
  const off = prototypeOnly();   // closed unless NEXT_PUBLIC_APP_MODE=prototype
  if (off) return off;
  const body = await req.json().catch(() => ({}));
  if (!isClient(body.k)) return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  const cur = await readState();
  if (cur.status === "submitted") return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  const o = body.overrides || {};
  const next = {
    ...cur,
    history: cur.history || [],
    overrides: { hidden: o.hidden || {}, labels: o.labels || {}, order: o.order || {} },
    updatedAt: new Date().toISOString(),
  };
  try {
    await writeState(next);
  } catch (e) {
    return NextResponse.json({ error: "Could not save: " + e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updatedAt: next.updatedAt });
}
