// Website → Partners (CR-16): add, edit and delete partners in the portal; the logo route; what /partners lists.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../helpers/db";
import { OPS, UserError, LOGO_MAX_CHARS } from "@/lib/ops";
import { firmSnapshot, partnerRows } from "@/lib/data";

let t;
vi.mock("@/db/index", async (orig) => ({ ...(await orig()), getDb: async () => t.db }));
const { GET: logo } = await import("@/app/api/partner-logo/[id]/route");

beforeEach(async () => { t = await createTestDb(); });
afterEach(async () => { await t.close(); });

// a 1×1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const values = (d) => ({ details: { name: "Acme Infra", logo: PNG, description: "Site security for the new plant.", cost: "125000", ...d } });
const fails = async (p) => { try { await p; } catch (e) { if (e instanceof UserError) return e; throw e; } throw new Error("did not fail"); };

describe("partners", () => {
  it("are added, listed (with the logo's address, not the image), edited and deleted, without needing a firm", async () => {
    const a = await OPS.savePartner(t.db, { values: values() });
    let [row] = await partnerRows(t.db);
    expect(row).toMatchObject({ id: a.id, name: "Acme Infra", description: "Site security for the new plant.", cost: 125000 });
    expect(row.logo).toMatch(new RegExp(`^/api/partner-logo/${a.id}\\?v=\\d+$`));
    expect((await firmSnapshot(t.db, null)).partners).toHaveLength(1);   // no firm exists, the list is still there

    expect((await OPS.getPartner(t.db, { partnerId: a.id })).details).toEqual({ name: "Acme Infra", description: "Site security for the new plant.", cost: "125000.00", logo: PNG });
    await OPS.savePartner(t.db, { partnerId: a.id, values: values({ name: "Acme Infra Ltd", logo: "", cost: "" }) });
    [row] = await partnerRows(t.db);
    expect(row).toMatchObject({ name: "Acme Infra Ltd", logo: null, cost: null });

    expect(await OPS.deletePartner(t.db, { partnerId: a.id })).toEqual({ deleted: a.id, name: "Acme Infra Ltd" });
    expect(await partnerRows(t.db)).toEqual([]);
  });

  it("needs a name; refuses a negative cost, a non-image logo, an SVG and an oversized image", async () => {
    expect((await fails(OPS.savePartner(t.db, { values: values({ name: " " }) }))).fields).toEqual({ "details.name": "Required" });
    expect((await fails(OPS.savePartner(t.db, { values: values({ cost: "-5" }) }))).fields["details.cost"]).toBeTruthy();
    for (const bad of ["https://example.com/logo.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PGI+"]) {
      expect((await fails(OPS.savePartner(t.db, { values: values({ logo: bad }) }))).fields["details.logo"]).toBe("Choose a PNG, JPG or WebP image");
    }
    const huge = `data:image/png;base64,${"A".repeat(LOGO_MAX_CHARS)}`;
    expect((await fails(OPS.savePartner(t.db, { values: values({ logo: huge }) }))).fields["details.logo"]).toMatch(/too large/);
    expect(await partnerRows(t.db)).toEqual([]);
  });

  it("serves the logo as an image; 404 for no logo or an unknown id", async () => {
    const a = await OPS.savePartner(t.db, { values: values() });
    const r = await logo(new Request("http://x"), { params: Promise.resolve({ id: String(a.id) }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await r.arrayBuffer()).subarray(1, 4).toString()).toBe("PNG");
    const b = await OPS.savePartner(t.db, { values: values({ name: "No Logo Co", logo: "" }) });
    for (const id of [String(b.id), "999", "abc"]) expect((await logo(new Request("http://x"), { params: Promise.resolve({ id }) })).status).toBe(404);
  });
});
