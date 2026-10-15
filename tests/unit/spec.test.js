// The UI must match the client's frozen field list (docs/client-spec-v1.json, submitted 12 Oct 2026)
// plus the change requests listed in docs/CHANGES.md. Any other drift fails the build.
import { describe, it, expect } from "vitest";
import spec from "@/docs/client-spec-v1.json";
import { finalSpec, EMPTY } from "@/lib/resolve";

const ours = finalSpec(EMPTY);
const theirs = spec.spec;
const labels = (block) => block.items.map((i) => i.label);
const isSubsequence = (small, big) => { let i = 0; for (const x of big) if (x === small[i]) i++; return i === small.length; };

const RENAMED_SCREEN = { profile: "dispatch_register" };
const RETITLED = { profile: "Dispatch Register" };            // was "Contractor Profile" under a "Dispatch Register" menu
const MENU_LABEL = { Complaince: "Compliance" };               // spelling fixed
// CR-1 (15 Oct): attendance is typed on the Wage Entry screen, so the separate attendance screens are gone
const REMOVED = ["att_new", "att_submitted", "att_approved", "att_entry"];
// CR-1: these screens gained fields/sections (Firm, Config, OT columns); every v1 field must still be there, in order
const EXTENDED = ["wo_new", "wo_edit", "wo_ongoing", "wage_entry"];

describe("menu", () => {
  it("has the client's groups in the client's order", () => {
    expect(ours.menu.map((g) => g.label)).toEqual(theirs.menu.map((g) => MENU_LABEL[g.label] ?? g.label));
  });
  it("has the client's items under each group", () => {
    for (const g of theirs.menu) {
      const mine = ours.menu.find((x) => x.label === (MENU_LABEL[g.label] ?? g.label));
      expect(mine?.items?.map((i) => i.label) ?? [], g.label).toEqual((g.items ?? []).map((i) => i.label));
    }
  });
});

describe("v1 screens", () => {
  for (const screen of theirs.screens) {
    const id = RENAMED_SCREEN[screen.id] ?? screen.id;
    if (REMOVED.includes(id)) {
      it(`${id} was removed by CR-1`, () => expect(ours.screens.find((s) => s.id === id)).toBeUndefined());
      continue;
    }
    describe(id, () => {
      const mine = ours.screens.find((s) => s.id === id);
      it("exists with the agreed title", () => {
        expect(mine).toBeDefined();
        expect(mine.title).toBe(RETITLED[screen.id] ?? screen.title);
      });
      if (EXTENDED.includes(id)) {
        it("keeps every v1 field and column, in order (additions allowed)", () => {
          for (const b of screen.blocks.filter((x) => x.type !== "notes")) {
            const m = mine.blocks.find((x) => x.title === b.title);
            expect(m, `${id} › ${b.title}`).toBeDefined();
            expect(isSubsequence(labels(b), labels(m)), `${id} › ${b.title}: ${labels(b).join(" | ")}`).toBe(true);
          }
        });
      } else {
        it("has exactly the v1 sections, fields and columns, in order", () => {
          expect(mine.blocks.map((b) => b.title)).toEqual(screen.blocks.map((b) => b.title));
          screen.blocks.forEach((b, i) => expect(labels(mine.blocks[i]), `${id} › ${b.title}`).toEqual(labels(b)));
        });
        it("keeps required markers and option lists", () => {
          screen.blocks.forEach((b, i) => b.items.forEach((item, j) => {
            const m = mine.blocks[i].items[j];
            expect(!!m.required, `${id} › ${item.label} required`).toBe(!!item.required);
            if (item.options) expect(m.options, `${id} › ${item.label} options`).toEqual(item.options);
          }));
        });
      }
    });
  }
});

describe("CR-1 additions", () => {
  const screen = (id) => ours.screens.find((s) => s.id === id);
  const block = (id, title) => screen(id).blocks.find((b) => b.title === title);

  it("Create Firm screen collects the firm details", () => {
    expect(labels(block("create_firm", "Firm Details"))).toEqual(expect.arrayContaining(["Firm Name", "CUIN", "GSTIN No", "PF Registration No", "ESIC No"]));
  });
  it("New Work Order starts with the Firm and carries the Config sections", () => {
    expect(labels(block("wo_new", "Work order details"))[0]).toBe("Firm");
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
