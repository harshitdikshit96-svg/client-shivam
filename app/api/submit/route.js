import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/store";
import { isAdmin, isClient } from "@/lib/auth";
import { prototypeOnly } from "@/lib/http";

export const dynamic = "force-dynamic";

const clean = (o = {}) => ({ hidden: o.hidden || {}, labels: o.labels || {}, order: o.order || {} });

// POST { k, overrides }                 -> client submits final (locks editing, saves a new version)
// POST { a, action: "reopen", note? }   -> admin reopens for another round (versions are kept)
export async function POST(req) {
  const off = prototypeOnly();   // closed unless NEXT_PUBLIC_APP_MODE=prototype
  if (off) return off;
  const body = await req.json().catch(() => ({}));
  const cur = await readState();
  const history = Array.isArray(cur.history) ? cur.history : [];
  const events = Array.isArray(cur.events) ? cur.events : [];
  const now = new Date().toISOString();

  if (body.action === "reopen") {
    if (!isAdmin(body.a)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
    const next = {
      ...cur,
      status: "draft",
      submittedAt: null,
      reopenedAt: now,
      events: [...events, { type: "reopened", at: now, afterVersion: history.length, note: (body.note || "").slice(0, 500) }],
    };
    await writeState(next);
    return NextResponse.json({ ok: true, status: next.status });
  }

  if (!isClient(body.k)) return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  if (cur.status === "submitted") return NextResponse.json({ ok: true, status: "submitted" });
  const overrides = clean(body.overrides || cur.overrides);
  const version = history.length + 1;
  const next = {
    ...cur,
    overrides,
    status: "submitted",
    updatedAt: now,
    submittedAt: now,
    history: [...history, { version, submittedAt: now, overrides }],
    events: [...events, { type: "submitted", at: now, version }],
  };
  try {
    await writeState(next);
  } catch (e) {
    return NextResponse.json({ error: "Could not save: " + e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "submitted", submittedAt: now, version });
}
