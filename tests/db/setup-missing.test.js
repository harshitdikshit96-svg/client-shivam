// A deployed app whose database was never migrated (Neon with no tables): the session API must explain that,
// not crash with a bare 500.
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";

let GET, POST;
beforeAll(async () => {
  process.env.DATABASE_URL = "pglite:memory://";   // an empty database: no tables at all
  ({ GET, POST } = await import("@/app/api/session/route.js"));
});

describe("database not set up", () => {
  it("GET /api/session says the tables are missing and how to fix it", async () => {
    const r = await GET(new NextRequest("http://localhost/api/session"));
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.setup).toBe(true);
    expect(body.error).toMatch(/has not been set up yet.*npm run db:migrate.*db:login/);
  });
  it("logging in says the same", async () => {
    const r = await POST(new NextRequest("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "a", password: "b" }),
    }));
    expect(r.status).toBe(500);
    expect((await r.json()).error).toMatch(/npm run db:migrate/);
  });
});
