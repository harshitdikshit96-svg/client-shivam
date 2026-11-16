// GET /api/partner-logo/ID — a partner's logo as an image (CR-16). Public: the website's /partners page shows it.
// The address carries ?v=<last change>, so browsers may keep it; a new logo gets a new address.
import { eq } from "drizzle-orm";
import { getDb } from "@/db/index";
import { partners } from "@/db/schema";

export const dynamic = "force-dynamic";
const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/;

export async function GET(req, { params }) {
  const id = Number((await params).id);
  try {
    const db = await getDb();
    const [p] = Number.isInteger(id) && id > 0 ? await db.select({ logo: partners.logo }).from(partners).where(eq(partners.id, id)) : [];
    const m = p?.logo?.match(DATA_URL);
    if (!m) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    console.error("GET /api/partner-logo", e);
    return new Response("Not available", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
