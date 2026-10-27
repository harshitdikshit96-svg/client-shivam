// Do the screens show the database's relations correctly? For every work order and every workman of the demo
// data, the rendered page is compared with plain SQL on the tables (independent of lib/data.js, which the
// screens use): firm → work orders → engagements ↔ workmen → wage months → bills, plus list counts and Home.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, within, waitFor, cleanup } from "@testing-library/react";
import { CustProvider } from "@/components/Cust";
import { DataProvider } from "@/components/Data";
import PageView from "@/components/PageView";
import { SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";
import { createTestDb } from "../helpers/db";
import { loadDemoData } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";

let t, firms;
const sql = async (q, params = []) => (await t.client.query(q, params)).rows;
const d = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const inr = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

beforeAll(async () => {
  t = await createTestDb();
  await loadDemoData(t.db);
  firms = await sql("SELECT id, name, cuin FROM firms ORDER BY id");
  HTMLElement.prototype.scrollIntoView = vi.fn();
}, 60000);
afterAll(async () => { await t.close(); });

async function show(firmId, screenId, params = {}) {
  cleanup();
  const data = await firmSnapshot(t.db, firmId);
  render(
    <CustProvider k={null} initial={{ overrides: EMPTY, status: "final" }}>
      <DataProvider api={async () => data} initialData={data}>
        <PageView screen={SCREEN_BY_ID[screenId]} go={() => {}} params={params} />
      </DataProvider>
    </CustProvider>,
  );
  await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
}

/** Rows of the table under a section title, as arrays of cell texts (the empty-state row is ignored). */
function tableRows(title) {
  const heading = screen.queryByText(title, { selector: "h3" });
  const section = heading ? heading.closest("section") : document.body;   // list screens have one table and no section title
  return within(section).queryAllByRole("row").slice(1).map((r) => within(r).queryAllByRole("cell").map((c) => c.textContent.trim()))
    .filter((cells) => cells.length > 1);
}
const sorted = (a) => [...a].sort();

describe.each([0, 1])("firm %i", (fi) => {
  const firm = () => firms[fi];

  it("every work order page lists exactly its engagements, wage months and bills", async () => {
    const orders = await sql("SELECT id, wo_number FROM work_orders WHERE firm_id = $1", [firm().id]);
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      await show(firm().id, "wo_view", { wo: o.id });
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(o.wo_number);

      const engs = await sql(`SELECT w.wuin, e.engaged_from::text AS f, e.engaged_to::text AS t FROM engagements e JOIN workmen w ON w.id = e.workman_id WHERE e.work_order_id = $1`, [o.id]);
      const shownEngs = tableRows("Workmen on this work order").map((c) => `${c[0]}|${c[4]}|${c[5]}`);
      expect(sorted(shownEngs), `${o.wo_number} engagements`).toEqual(sorted(engs.map((e) => `${e.wuin}|${d(e.f)}|${d(e.t)}`)));

      const months = await sql(`SELECT s.year, s.month, count(l.id)::int AS n, coalesce(sum(l.net_earnings), 0) AS net
        FROM monthly_sheets s LEFT JOIN wage_lines l ON l.sheet_id = s.id WHERE s.work_order_id = $1 GROUP BY s.id`, [o.id]);
      const shownMonths = tableRows("Wage months").map((c) => `${c[0]}|${c[2]}|${c[5]}`);
      expect(sorted(shownMonths), `${o.wo_number} wage months`).toEqual(sorted(months.map((m) => `${MONTHS[m.month - 1]} ${m.year}|${m.n}|${inr(m.net)}`)));

      const bills = await sql("SELECT bill_number FROM dispatch_register WHERE work_order_id = $1", [o.id]);
      expect(sorted(tableRows("Bills (Dispatch Register)").map((c) => c[0])), `${o.wo_number} bills`).toEqual(sorted(bills.map((b) => b.bill_number)));
    }
  });

  it("every workman page lists exactly his engagements and his wage lines", async () => {
    const people = await sql("SELECT id, wuin FROM workmen WHERE firm_id = $1", [firm().id]);
    for (const p of people) {
      await show(firm().id, "wm_view", { wm: p.id });
      const engs = await sql(`SELECT o.wo_number, e.engaged_from::text AS f, e.engaged_to::text AS t FROM engagements e JOIN work_orders o ON o.id = e.work_order_id WHERE e.workman_id = $1`, [p.id]);
      expect(sorted(tableRows("Engagements").map((c) => `${c[0]}|${c[2]}|${c[3]}`)), `${p.wuin} engagements`)
        .toEqual(sorted(engs.map((e) => `${e.wo_number}|${d(e.f)}|${d(e.t)}`)));
      const lines = await sql(`SELECT s.year, s.month, o.wo_number, l.days_worked, l.net_earnings FROM wage_lines l
        JOIN monthly_sheets s ON s.id = l.sheet_id JOIN work_orders o ON o.id = s.work_order_id WHERE l.workman_id = $1`, [p.id]);
      expect(sorted(tableRows("Wages").map((c) => `${c[0]}|${c[1]}|${c[2]}|${c[5]}`)), `${p.wuin} wages`)
        .toEqual(sorted(lines.map((l) => `${MONTHS[l.month - 1]} ${l.year}|${l.wo_number}|${Number(l.days_worked)}|${inr(l.net_earnings)}`)));
    }
  });

  it("lists: active / inactive / moved-out workmen and the engaged counts match the tables", async () => {
    const state = await sql(`SELECT w.wuin,
        CASE WHEN w.date_of_exit IS NOT NULL THEN 'moved' WHEN EXISTS (SELECT 1 FROM engagements e WHERE e.workman_id = w.id AND e.engaged_to IS NULL) THEN 'active' ELSE 'inactive' END AS s
      FROM workmen w WHERE w.firm_id = $1`, [firm().id]);
    for (const [screenId, s, col] of [["wm_active", "active", 1], ["wm_inactive", "inactive", 1], ["wm_moved", "moved", 1]]) {
      await show(firm().id, screenId);
      expect(sorted(tableRows("x").map((c) => c[col])), screenId).toEqual(sorted(state.filter((x) => x.s === s).map((x) => x.wuin)));
    }
    const counts = await sql(`SELECT o.wo_number, (SELECT count(*)::int FROM engagements e WHERE e.work_order_id = o.id AND e.engaged_to IS NULL) AS n
      FROM work_orders o WHERE o.firm_id = $1 AND o.status = 'approved'`, [firm().id]);
    await show(firm().id, "wo_ongoing");
    const head = within(screen.getAllByRole("row")[0]).getAllByRole("columnheader").map((h) => h.textContent);
    const at = head.findIndex((h) => h.startsWith("Workmen Engaged"));
    expect(sorted(tableRows("x").map((c) => `${c[1]}|${c[at]}`))).toEqual(sorted(counts.map((c) => `${c.wo_number}|${c.n}`)));
  });

  it("Home: CUIN in the title and the status counts", async () => {
    const [c] = await sql(`SELECT count(*) FILTER (WHERE status = 'pending')::int AS p, count(*) FILTER (WHERE status = 'approved')::int AS a,
      count(*) FILTER (WHERE status = 'rejected')::int AS r FROM work_orders WHERE firm_id = $1`, [firm().id]);
    await show(firm().id, "home");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(firm().cuin);
    const value = (label) => screen.getByText(label).closest(".stat").querySelector(".stat-value").textContent;
    expect([value("Pending Work Order Approvals"), value("Approved Work Orders"), value("Rejected Work Orders")]).toEqual([String(c.p), String(c.a), String(c.r)]);
  });
});
