// The UI must match the client's frozen field list (docs/client-spec-v1.json, submitted 12 Oct 2026)
// plus the change requests listed in docs/CHANGES.md. Any other drift fails the build.
import { describe, it, expect } from "vitest";
import spec from "@/docs/client-spec-v1.json";
import { finalSpec, EMPTY } from "@/lib/resolve";
import { SCREEN_BY_ID, fieldOf } from "@/lib/schema";
import { FORMATS } from "@/lib/validate";
import { RULES } from "@/lib/rules";

const ours = finalSpec(EMPTY);
const theirs = spec.spec;
const labels = (block) => block.items.map((i) => i.label);
const isSubsequence = (small, big) => { let i = 0; for (const x of big) if (x === small[i]) i++; return i === small.length; };

const RENAMED_SCREEN = { profile: "dispatch_register" };
const RETITLED = { profile: "Dispatch Register" };            // was "Contractor Profile" under a "Dispatch Register" menu
const MENU_LABEL = { Complaince: "Compliance" };               // spelling fixed
// CR-1 (15 Oct): attendance is typed on the Wage Entry screen, so the separate attendance screens are gone
const REMOVED = ["att_new", "att_submitted", "att_approved", "att_entry", "wm_photo"];   // attendance: CR-1; Workmen Photo: CR-6

// Screens that gained fields, columns, sections or buttons. Every v1 item must still be there, in order.
const EXTENDED = [
  "wo_new", "wo_edit", "wo_ongoing", "wage_entry",                                         // CR-1
  "home", "wo_completed", "wo_pending", "wm_edit", "wm_engage", "wage_new", "wage_submitted", // CR-2
  "wage_approved", "wage_slip", "dispatch_register",
];
// CR-2: blocks renamed, wording updated, and items removed on purpose
const RENAMED_BLOCK = { dispatch_register: { "Select Firm": "Bill Details" } };
const REWORDED = {
  // the steps pointed at Attendance screens that CR-1 removed
  "Step 3: Mark Attendance — Attendance → New Attendance. Save attendance for workmen engaged in the period, then submit after verification.":
    "Step 3: Wage Entry — Wages → New Wage Entry. Choose the work order and month, type Days Worked (and OT) for each engaged workman, Save, then Submit after verification.",
  "Step 4: Wage Entry — available under New Wage Entry after attendance submission. Verify and submit wage details.":
    "Step 4: Track — Submitted Wages, Approved Wages and Worker Wage Slip under Wages; bills and GST/EPF/ESIC payment status in Compliance → Dispatch Register.",
  "Important: ensure workmen engagement is correct, attendance is submitted before wage entry, and all mandatory workman fields are filled.":
    "Important: ensure workmen engagement is correct and all mandatory workman fields are filled before wage entry.",
  "Edit": "Save Bill",                                          // Dispatch Register: the form is always editable
};
const DROPPED = { wo_new: ["Firm"] };                             // CR-2: the firm comes from the top bar
// option lists now filled from the selected firm's data
const DYNAMIC_OPTIONS = { wm_engage: ["Work Order"] };
// fields that became mandatory because the Dispatch Register is now a real form
const NOW_REQUIRED = { dispatch_register: ["Party Name / Contract Number", "Bill Number", "Bill Date", "Taxable Amount"] };
// CR-5: New Work Order never asked for these, so requiring them blocked the first edit of every order
const NO_LONGER_REQUIRED = { wo_edit: [
  "Name of the supervisor / Auth. Personnel representing the contractor",
  "Contact Number of the Supervisor / Auth. Personnel representing the contractor", "Nature of Work", "Area of Operation",
] };

const word = (l) => REWORDED[l] ?? l;
const v1Items = (id, b) => b.items.filter((i) => !(DROPPED[id] ?? []).includes(i.label)).map((i) => ({ ...i, label: word(i.label) }));

// CR-2 menu: Home first; Submitted / Approved Wages and Worker Wage Slip reachable
const CR2_MENU = (menu) => {
  const m = menu.map((g) => ({ ...g, label: MENU_LABEL[g.label] ?? g.label }));
  const home = m.findIndex((g) => g.label === "Home");
  m.unshift(...m.splice(home, 1));
  const wages = m.find((g) => g.label === "Wages");
  wages.items = [...wages.items, { label: "Submitted Wages" }, { label: "Approved Wages" }, { label: "Worker Wage Slip" }];
  const workmen = m.find((g) => g.label === "Workmen");
  workmen.items = workmen.items.filter((i) => i.label !== "Workmen Photo");   // CR-6
  return m;
};

describe("menu", () => {
  const expected = CR2_MENU(theirs.menu);
  it("has the client's groups, with Home first (CR-2)", () => {
    expect(ours.menu.map((g) => g.label)).toEqual(expected.map((g) => g.label));
    expect(ours.menu[0].label).toBe("Home");
  });
  it("has the client's items under each group (plus the CR-2 wage screens)", () => {
    for (const g of expected) {
      const mine = ours.menu.find((x) => x.label === g.label);
      expect(mine?.items?.map((i) => i.label) ?? [], g.label).toEqual((g.items ?? []).map((i) => i.label));
    }
  });
});

describe("v1 screens", () => {
  for (const screen of theirs.screens) {
    const id = RENAMED_SCREEN[screen.id] ?? screen.id;
    if (REMOVED.includes(id)) {
      it(`${id} was removed (CR-1 / CR-6)`, () => expect(ours.screens.find((s) => s.id === id)).toBeUndefined());
      continue;
    }
    describe(id, () => {
      const mine = ours.screens.find((s) => s.id === id);
      const blockOf = (b) => mine.blocks.find((x) => x.title === (RENAMED_BLOCK[id]?.[b.title] ?? b.title));
      it("exists with the agreed title", () => {
        expect(mine).toBeDefined();
        expect(mine.title).toBe(RETITLED[screen.id] ?? screen.title);
      });
      if (EXTENDED.includes(id)) {
        it("keeps every v1 field and column, in order (additions allowed)", () => {
          for (const b of screen.blocks.filter((x) => x.type !== "notes")) {
            const m = blockOf(b);
            expect(m, `${id} › ${b.title}`).toBeDefined();
            const want = v1Items(id, b).map((i) => i.label);
            expect(isSubsequence(want, labels(m)), `${id} › ${b.title}: ${want.join(" | ")}`).toBe(true);
          }
        });
      } else {
        it("has exactly the v1 sections, fields and columns, in order", () => {
          expect(mine.blocks.map((b) => b.title)).toEqual(screen.blocks.map((b) => b.title));
          screen.blocks.forEach((b, i) => expect(labels(mine.blocks[i]), `${id} › ${b.title}`).toEqual(v1Items(id, b).map((x) => x.label)));
        });
      }
      it("keeps required markers and option lists", () => {
        for (const b of screen.blocks.filter((x) => x.type !== "notes")) {
          const m = blockOf(b);
          for (const item of v1Items(id, b)) {
            const mi = m.items.find((x) => x.label === item.label);
            const required = (!!item.required || (NOW_REQUIRED[id] ?? []).includes(item.label)) && !(NO_LONGER_REQUIRED[id] ?? []).includes(item.label);
            expect(!!mi.required, `${id} › ${item.label} required`).toBe(required);
            if (item.options && !(DYNAMIC_OPTIONS[id] ?? []).includes(item.label)) expect(mi.options, `${id} › ${item.label} options`).toEqual(item.options);
          }
        }
      });
    });
  }
});

describe("CR-1 additions", () => {
  const screen = (id) => ours.screens.find((s) => s.id === id);
  const block = (id, title) => screen(id).blocks.find((b) => b.title === title);

  it("Create Firm screen collects the firm details", () => {
    expect(labels(block("create_firm", "Firm Details"))).toEqual(expect.arrayContaining(["Firm Name", "CUIN", "GSTIN No", "PF Registration No", "ESIC No"]));
  });
  it("New / Edit Work Order and Config carry the Config sections", () => {
    for (const id of ["wo_new", "wo_edit", "wo_config"]) {
      expect(labels(block(id, "Config — Per Day Wages"))).toEqual(["Per Day Wage (₹)", "VDA per Day (₹)"]);
      expect(labels(block(id, "Config — Deductions & Overtime"))).toEqual(expect.arrayContaining(["EPF / CMPF (% of wages)", "ESI (% of gross)", "Overtime rate (× normal hourly rate)"]));
    }
  });
  it("Ongoing work orders link to Config", () => {
    expect(labels(block("wo_ongoing", "Work order list"))).toContain("Config");
  });
  it("Wage Entry takes days worked and OT as typed columns", () => {
    const grid = labels(block("wage_entry", "Wage grid"));
    expect(grid.slice(2, 5)).toEqual(["Days Worked", "OT Hrs", "OT Min"]);
  });
});

describe("CR-2 (15 Oct 2026)", () => {
  const screen = (id) => ours.screens.find((s) => s.id === id);
  const block = (id, title) => screen(id).blocks.find((b) => b.title === title);

  it("no form asks for the firm: it is always the one selected in the top bar", () => {
    for (const s of ours.screens) {
      for (const b of s.blocks.filter((x) => x.type === "form")) expect(labels(b), `${s.id} › ${b.title}`).not.toContain("Firm");
    }
  });
  it("Wage Entry starts by choosing the work order and the month", () => {
    expect(labels(screen("wage_entry").blocks[0])).toEqual(["Work Order", "Year", "Month"]);
  });
  it("work orders and workmen each have a page with their linked records", () => {
    expect(screen("wo_view").blocks.map((b) => b.title)).toEqual(expect.arrayContaining(["Workmen on this work order", "Wage months", "Bills (Dispatch Register)"]));
    expect(screen("wm_view").blocks.map((b) => b.title)).toEqual(expect.arrayContaining(["Engagements", "Wages"]));
  });
  it("Dispatch Register lists the bills and links each to a work order", () => {
    expect(labels(block("dispatch_register", "Bills"))).toEqual(expect.arrayContaining(["Bill Number", "Work Order Number"]));
    expect(labels(block("dispatch_register", "Bill Details"))[0]).toBe("Work Order");
  });
  it("Bulk Accommodation says what it does", () => {
    const btn = SCREEN_BY_ID.wm_active.blocks.find((b) => b.id === "top").items[0];
    expect(btn.hint).toMatch(/Accommodation/);
  });
  it("no screen still points users to the removed Attendance screens", () => {
    const text = JSON.stringify(ours);
    expect(text).not.toMatch(/Attendance → New Attendance|attendance submission/);
  });
});

describe("CR-3: everything editable, every typed field validated", () => {
  const forms = ours.screens.flatMap((s) => SCREEN_BY_ID[s.id].blocks.filter((b) => b.type === "form" || b.type === "rates").map((b) => [s.id, b]));
  it("no form field is read-only (locking is a choice in lib/rules.js, empty by default)", () => {
    for (const [id, b] of forms) for (const it of b.items) expect(it.readOnly, `${id} › ${it.label}`).toBeFalsy();
    expect(RULES.lockedAfterCreate).toEqual({});
  });
  it("every typed field of every form has a known format (length + pattern)", () => {
    for (const [id, b] of forms) {
      for (const it of b.items.filter((x) => !["select", "file", "button"].includes(x.input))) {
        expect(FORMATS[it.format], `${id} › ${b.title} › ${it.label} has no format`).toBeDefined();
      }
    }
  });
  it("number-like fields only take digits, with the right length", () => {
    const f = (screen, block, item) => fieldOf(screen, block, item).format;
    expect(f("wm_edit", "details", "aadhaar")).toBe("aadhaar");
    expect(f("wm_edit", "nominee", "aadhaar")).toBe("aadhaar");
    for (const [s2, b, i] of [["wm_edit", "details", "mobile"], ["wm_edit", "emergency", "phone"], ["create_firm", "form", "mobile"], ["wo_edit", "form", "svPhone"]]) expect(f(s2, b, i)).toBe("mobile");
    expect(f("create_firm", "form", "pincode")).toBe("pincode");
    expect(f("wm_edit", "details", "bankAc")).toBe("bankAc");
  });
  it("Edit Work Order can change everything New Work Order sets", () => {
    const edit = SCREEN_BY_ID.wo_edit.blocks.find((b) => b.id === "form").items.map((i) => i.id);
    const created = SCREEN_BY_ID.wo_new.blocks.find((b) => b.id === "form").items.map((i) => i.id);
    expect(created.filter((id) => !edit.includes(id))).toEqual([]);
  });
  it("the workman form has a WUIN field (blank = next number) and Aadhaar", () => {
    const ids = SCREEN_BY_ID.wm_edit.blocks.find((b) => b.id === "details").items.map((i) => i.id);
    expect(ids.slice(0, 2)).toEqual(["wuin", "aadhaar"]);
  });
});
