// The screens with real data: a real (in-memory) PostgreSQL loaded with the demo data, the real operations
// (lib/ops.js) behind the buttons, and the React screens in jsdom.
// The rule these tests hold: every click gives the user something — a new screen, a message, a dialog, a file —
// and every message about a missing step says how to do it.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustProvider } from "@/components/Cust";
import { DataProvider, ActionError } from "@/components/Data";
import PageView from "@/components/PageView";
import { SCREENS, SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";
import { createTestDb } from "../helpers/db";
import { loadDemoData } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";
import { OPS, UserError, explainDbError } from "@/lib/ops";

let t, ids;
beforeAll(async () => {
  t = await createTestDb();
  ids = await loadDemoData(t.db);
}, 60000);
afterAll(async () => { await t.close(); });

/** The API the screens talk to, served by the real operations on the test database. */
const apiFor = (db) => async (method, body, firmId) => {
  if (method === "GET") return firmSnapshot(db, firmId);
  try {
    return await OPS[body.op](db, body);
  } catch (e) {
    const u = e instanceof UserError ? e : explainDbError(e);
    if (u) throw new ActionError(u.message, { fields: u.fields, fix: u.fix });
    throw e;
  }
};

async function renderLive(screenId, params = {}, { db = t.db, firmId } = {}) {
  const data = await firmSnapshot(db, firmId ?? ids.firms[0].id);
  const go = vi.fn();
  const utils = render(
    <CustProvider k={null} initial={{ overrides: EMPTY, status: "final" }}>
      <DataProvider api={apiFor(db)} initialData={data}>
        <PageView screen={SCREEN_BY_ID[screenId]} go={go} params={params} />
      </DataProvider>
    </CustProvider>,
  );
  await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
  return { ...utils, go, data };
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
  window.print = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});   // CSV downloads
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

// ---------------- every button does something ----------------
const recordParams = () => {
  const wo1 = ids.orders[0].id;
  return {
    wo_view: [{ wo: wo1 }, { wo: ids.orders[2].id }, { wo: ids.orders[5].id }],
    wo_edit: [{ wo: wo1 }], wo_config: [{ wo: wo1 }],
    wm_view: [{ wm: ids.workers[0].id }], wm_edit: [{}, { wm: ids.workers[0].id }],
    wm_engage: [{}, { wo: wo1 }],
    wage_entry: [{ wo: wo1, y: 2026, m: 9 }, { wo: wo1, y: 2026, m: 8 }],
    wage_slip: [{ wuin: "DEMO-W01", sheet: ids.augustSheets[wo1].id }],
    create_firm: [{}, { edit: 1 }],
    dispatch_register: [{}],
  };
};

describe("every button on every screen does something", () => {
  const cases = () => SCREENS.flatMap((s) => (recordParams()[s.id] ?? [{}]).map((p) => [s.id, p]));
  // the cases need ids from the database, so they are expanded inside the test
  it("no click is silent, and none falls back to 'not available'", async () => {
    const silent = [];
    let clicked = 0;
    for (const [id, params] of cases()) {
      const first = await renderLive(id, params);
      const count = within(first.container).queryAllByRole("button").length;
      cleanup();
      for (let i = 0; i < count; i++) {
        const { container, go } = await renderLive(id, params);
        const btn = within(container).queryAllByRole("button")[i];
        if (!btn || btn.disabled) { cleanup(); continue; }
        const name = btn.textContent;
        await userEvent.click(btn);
        clicked++;
        let ok = false;
        try {
          await waitFor(() => {
            const did = go.mock.calls.length > 0 || screen.queryByRole("status") || screen.queryByRole("alert") || screen.queryByRole("dialog")
              || URL.createObjectURL.mock.calls.length > 0 || window.print.mock.calls.length > 0 || screen.queryByRole("region", { name: "Bulk Accommodation" }) || screen.queryByRole("listbox");
            expect(did).toBeTruthy();
          }, { timeout: 2000 });
          ok = true;
        } catch { /* recorded below */ }
        if (!ok) silent.push(`${id} ${JSON.stringify(params)} › "${name}"`);
        if (screen.queryByText("This action is not available yet.")) silent.push(`${id} › "${name}" is not wired`);
        cleanup();
      }
    }
    expect(silent).toEqual([]);
    expect(clicked).toBeGreaterThan(200);   // the test really went through the buttons
  }, 240000);
});

// ---------------- the issues reported on 15 Oct ----------------
describe("firm selection lives in the top bar only", () => {
  it("New Work Order has no Firm field and says which firm it saves under", async () => {
    await renderLive("wo_new");
    expect(screen.queryByLabelText("Firm")).toBeNull();
    expect(screen.getByText(/will be saved under Demo Security Services Pvt Ltd/)).toBeInTheDocument();
  });
});

describe("Aadhaar and the other workman fields", () => {
  it("can be typed when adding a new workman", async () => {
    await renderLive("wm_edit", {});
    const aadhaar = screen.getAllByLabelText("Aadhaar")[0];
    expect(aadhaar).not.toHaveAttribute("readonly");
    await userEvent.type(aadhaar, "123456789012");
    expect(aadhaar).toHaveValue("123456789012");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("New Workman");
  });
  it("can be corrected when editing an existing workman (CR-3: everything is editable)", async () => {
    await renderLive("wm_edit", { wm: ids.workers[0].id });
    const aadhaar = screen.getAllByLabelText("Aadhaar")[0];
    await waitFor(() => expect(aadhaar).toHaveValue("999900000001"));
    expect(aadhaar).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("WUIN")).toHaveValue("DEMO-W01");
    expect(screen.getByLabelText("WUIN")).not.toHaveAttribute("readonly");
  });
  it("only digits get into Aadhaar, at most 12, and a short one is flagged when leaving the field", async () => {
    await renderLive("wm_edit", {});
    const aadhaar = screen.getAllByLabelText("Aadhaar")[0];
    await userEvent.type(aadhaar, "12ab34 5678 9012 99");
    expect(aadhaar).toHaveValue("123456789012");
    await userEvent.clear(aadhaar);
    await userEvent.type(aadhaar, "12345");
    await userEvent.tab();
    expect(aadhaar.closest(".field")).toHaveTextContent("Should be 12 digits, numbers only");
    expect(aadhaar).toHaveAttribute("aria-invalid", "true");
  });
  it("mobile, IFSC and name are checked as they are left", async () => {
    await renderLive("wm_edit", {});
    const mobile = screen.getAllByLabelText("Mobile No")[0];
    await userEvent.type(mobile, "12345");
    await userEvent.tab();
    expect(mobile.closest(".field")).toHaveTextContent(/10-digit mobile/);
    const ifsc = screen.getByLabelText("Branch (IFSC)");
    await userEvent.type(ifsc, "sbin0001234");
    expect(ifsc).toHaveValue("SBIN0001234");
    const name = screen.getAllByLabelText("Name")[0];
    await userEvent.type(name, "R4mesh");
    await userEvent.tab();
    expect(name.closest(".field")).toHaveTextContent(/letters, spaces/);
  });
  it("adding a workman with missing fields marks each one and says how many", async () => {
    await renderLive("wm_edit", {});
    await userEvent.click(screen.getByRole("button", { name: "Add Workman" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Please correct the highlighted fields/);
    expect(screen.getAllByText("Required").length).toBeGreaterThan(3);
  });
});

describe("every typed field has a length limit on screen", () => {
  for (const id of ["create_firm", "wo_new", "wm_edit", "dispatch_register"]) {
    it(id, async () => {
      const { container } = await renderLive(id, {});
      const typed = [...container.querySelectorAll("input[type=text], textarea")];
      expect(typed.length).toBeGreaterThan(0);
      for (const el of typed) expect(el.maxLength, el.getAttribute("aria-label")).toBeGreaterThan(0);
    });
  }
});

describe("engagements and submitted wages can be corrected", () => {
  it("Edit on an engagement opens both dates", async () => {
    await renderLive("wm_view", { wm: ids.workers[0].id });
    const row = screen.getByText("Engagements").closest("section").querySelector("tbody tr");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByLabelText("Engaged From")).toHaveValue("2026-07-01");
    expect(within(dlg).getByLabelText("Engaged To")).toHaveValue("");
  });
  it("a submitted month offers Reopen for Editing", async () => {
    await renderLive("wage_entry", { wo: ids.orders[0].id, y: 2026, m: 8 });
    expect(screen.getByRole("button", { name: "Reopen for Editing" })).toBeInTheDocument();
  });
});

describe("records are linked to each other", () => {
  it("a work order page lists its workmen, wage months and bills", async () => {
    await renderLive("wo_view", { wo: ids.orders[0].id });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Work Order — DEMO-WO-001");
    const workmen = screen.getByText("Workmen on this work order").closest("section");
    expect(within(workmen).getAllByText(/^DEMO-W0[1-4]$/)).toHaveLength(4);
    const months = screen.getByText("Wage months").closest("section");
    expect(within(months).getByText("July 2026")).toBeInTheDocument();
    expect(within(months).getByText("September 2026")).toBeInTheDocument();
    expect(within(screen.getByText("Bills (Dispatch Register)").closest("section")).getByText("DEMO-BILL-01")).toBeInTheDocument();
  });
  it("a workman's work order opens the work order page", async () => {
    const { go } = await renderLive("wm_active");
    const row = screen.getByText("DEMO-W05").closest("tr");
    await userEvent.click(within(row).getByRole("button", { name: "DEMO-WO-002" }));
    expect(go).toHaveBeenCalledWith("wo_view", { wo: ids.orders[1].id });
  });
  it("a workman page shows the engagement history and the wages of each month", async () => {
    await renderLive("wm_view", { wm: ids.workers[0].id });
    const eng = screen.getByText("Engagements").closest("section");
    expect(within(eng).getByText("DEMO-WO-001")).toBeInTheDocument();
    const wages = screen.getByText("Wages", { selector: "h3" }).closest("section");
    expect(within(wages).getByText("August 2026")).toBeInTheDocument();
    expect(within(wages).getByText("12,613.00")).toBeInTheDocument();
  });
});

describe("Wage Entry: choose the work order, see its workmen, edit and save", () => {
  it("lists only the selected firm's work orders and the workmen engaged that month", async () => {
    await renderLive("wage_entry", { wo: ids.orders[0].id, y: 2026, m: 9 });
    const select = screen.getByLabelText("Work Order");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options.some((o) => o.startsWith("DEMO-WO-001"))).toBe(true);
    expect(options.some((o) => o.includes("coal loading"))).toBe(false);   // the other firm's order
    for (const w of ["DEMO-W01", "DEMO-W02", "DEMO-W03", "DEMO-W04"]) expect(screen.getByRole("button", { name: w })).toBeInTheDocument();
  });
  it("typing days calculates the row; Save stores it", async () => {
    const db2 = await createTestDb();
    const ids2 = await loadDemoData(db2.db);
    await renderLive("wage_entry", { wo: ids2.orders[0].id, y: 2026, m: 9 }, { db: db2.db, firmId: ids2.firms[0].id });
    const days = screen.getByLabelText("Days Worked DEMO-W02");
    await userEvent.type(days, "25");
    const row = days.closest("tr");
    expect(within(row).getAllByText("15,000.00").length).toBeGreaterThan(0);     // 25 × ₹600 (September rate)
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Saved wages of 2 workmen for September 2026/);
    const snap = await firmSnapshot(db2.db, ids2.firms[0].id);
    expect(snap.sheets.find((s) => s.month === 9 && s.woNo === "DEMO-WO-001").lines.map((l) => l.wuin)).toEqual(["DEMO-W01", "DEMO-W02"]);
    await db2.close();
  });
  it("a submitted month is shown read-only, with Approve instead of Save", async () => {
    await renderLive("wage_entry", { wo: ids.orders[0].id, y: 2026, m: 8 });
    expect(screen.queryByLabelText("Days Worked DEMO-W01")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByText(/locked and can only be viewed/)).toBeInTheDocument();
  });
});

describe("Bulk Accommodation explains itself and works", () => {
  it("opens a panel that says what accommodation is, then updates the ticked workmen", async () => {
    const db2 = await createTestDb();
    const ids2 = await loadDemoData(db2.db);
    await renderLive("wm_active", {}, { db: db2.db, firmId: ids2.firms[0].id });
    await userEvent.click(screen.getByRole("button", { name: "Bulk Accommodation" }));
    const panel = screen.getByRole("region", { name: "Bulk Accommodation" });
    expect(panel).toHaveTextContent(/where the workman stays/);
    await userEvent.selectOptions(within(panel).getByLabelText("Accommodation to set"), "Company Quarter");
    await userEvent.click(within(panel).getByRole("button", { name: /Apply to 6 ticked/ }));
    expect(await screen.findByRole("status")).toHaveTextContent(/set to "Company Quarter" for 6 workmen/);
    await db2.close();
  });
});

describe("an empty database guides the user step by step", () => {
  let empty;
  beforeAll(async () => { empty = await createTestDb(); });
  afterAll(async () => { await empty.close(); });

  for (const id of ["home", "wo_ongoing", "wo_new", "wm_active", "wm_engage", "wage_entry", "wage_new", "dispatch_register"]) {
    it(`${id}: says to create a firm first, with the button to do it`, async () => {
      const { go } = await renderLive(id, {}, { db: empty.db, firmId: null });
      expect(screen.getByRole("note")).toHaveTextContent(/No firm yet/);
      await userEvent.click(within(screen.getByRole("note")).getByRole("button", { name: "Create Firm" }));
      expect(go).toHaveBeenCalledWith("create_firm", {});
    });
  }

  it("a new firm with nothing in it: Engage says to create and approve a work order", async () => {
    const f = await OPS.createFirm(empty.db, { values: { form: { name: "Fresh Firm" } } });
    await renderLive("wm_engage", {}, { db: empty.db, firmId: f.id });
    expect(screen.getByRole("note")).toHaveTextContent(/no approved work order/);
    expect(within(screen.getByRole("note")).getByRole("button", { name: "Create New Work Order" })).toBeInTheDocument();
  });

  it("a new firm: home shows the getting-started steps, first one done", async () => {
    const f = (await firmSnapshot(empty.db, null)).firm;
    await renderLive("home", {}, { db: empty.db, firmId: f.id });
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do this next" }).closest("li")).toHaveTextContent(/Create a work order/);
  });
});

describe("Dispatch Register", () => {
  it("each bill row has Edit, which loads that bill into the form", async () => {
    await renderLive("dispatch_register");
    const row = screen.getByText("DEMO-BILL-02").closest("tr");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(screen.getByLabelText("Bill Number")).toHaveValue("DEMO-BILL-02"));
    expect(screen.getByRole("button", { name: "Save Bill" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Work Order")).getByRole("option", { selected: true })).toHaveTextContent("DEMO-WO-002");
  });
});

describe("Wage Entry flags impossible days while typing (before Save)", () => {
  it("31 days in September is flagged on the row", async () => {
    await renderLive("wage_entry", { wo: ids.orders[0].id, y: 2026, m: 9 });
    await userEvent.type(screen.getByLabelText("Days Worked DEMO-W02"), "31");
    expect(screen.getByText("DEMO-W02: 31 days entered, but September 2026 has 30 days")).toBeInTheDocument();
  });
});

describe("Work Location (District) suggests the State's districts, and takes any name", () => {
  const district = () => screen.getByRole("combobox", { name: "Work Location (District)" });
  const shown = () => within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
  it("opens the State's districts in the app's own drop-down; typing filters it; any name can be typed", async () => {
    await renderLive("wo_new");
    expect(district()).toHaveAttribute("placeholder", "Choose the State first, or type");
    await userEvent.click(district());
    expect(screen.queryByRole("listbox")).toBeNull();   // no State yet: nothing to suggest
    await userEvent.selectOptions(screen.getByLabelText("Work Location (State)"), "Uttar Pradesh");
    await userEvent.click(district());
    expect(shown()).toHaveLength(75);
    expect(shown()[0]).toBe("Agra");
    await userEvent.type(district(), "luck");
    expect(shown()).toEqual(["Lucknow"]);
    await userEvent.click(screen.getByRole("option", { name: "Lucknow" }));
    expect(district()).toHaveValue("Lucknow");
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.clear(district());
    await userEvent.type(district(), "New Town Area");
    expect(district()).toHaveValue("New Town Area");
    expect(screen.queryByRole("listbox")).toBeNull();   // no match: no empty pop-up
  });
  it("works from the keyboard: ↓ to move, Enter to pick, Esc to close", async () => {
    await renderLive("wo_new");
    await userEvent.selectOptions(screen.getByLabelText("Work Location (State)"), "Goa");
    await userEvent.click(district());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(district()).toHaveValue("South Goa");
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("the chevron opens and closes the list", async () => {
    await renderLive("wo_new");
    await userEvent.selectOptions(screen.getByLabelText("Work Location (State)"), "Goa");
    await userEvent.click(screen.getByRole("button", { name: "Show the list" }));
    expect(shown()).toEqual(["North Goa", "South Goa"]);
    await userEvent.click(screen.getByRole("button", { name: "Show the list" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("a new State clears a district picked from the old State's list, but keeps a typed one", async () => {
    await renderLive("wo_new");
    const state = screen.getByLabelText("Work Location (State)");
    await userEvent.selectOptions(state, "Uttar Pradesh");
    await userEvent.type(district(), "Lucknow");
    await userEvent.selectOptions(state, "Assam");
    expect(district()).toHaveValue("");
    await userEvent.type(district(), "Own Name");
    await userEvent.selectOptions(state, "Bihar");
    expect(district()).toHaveValue("Own Name");
  });
});

describe("Engage: the date of joining", () => {
  it("the calendar starts at the later of the work order's start and the workman's date of joining", async () => {
    const { data } = await renderLive("wm_engage", { wo: ids.orders[0].id });
    const wo = data.workOrders.find((o) => o.id === ids.orders[0].id);
    for (const w of data.workmen.filter((x) => x.state !== "moved")) {
      const input = screen.queryByLabelText(`New engagement from for ${w.wuin}`);
      if (!input) continue;   // already engaged here
      expect(input, w.wuin).toHaveAttribute("min", [wo.start, w.doj].sort().at(-1));
    }
  });
  it("an engagement before the date of joining says when the workman joined and how to fix it", async () => {
    const late = (await firmSnapshot(t.db, ids.firms[0].id)).workmen.find((w) => w.doj === "2026-10-01");
    const err = await OPS.engageWorkmen(t.db, { firmId: ids.firms[0].id, workOrderId: ids.orders[0].id, rows: [{ workmanId: late.id, from: "2026-09-15" }] }).catch((e) => e);
    expect(err.fields[`row.${late.id}`]).toMatch(/joined on 01\/10\/2026 \(Date of Joining\).*Pick a later date, or correct the Date of Joining/);
  });
});
