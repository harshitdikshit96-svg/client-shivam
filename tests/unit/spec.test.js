// The UI must match the client's frozen field list (docs/client-spec-v1.json, submitted 12 Oct 2026).
// Deliberate differences are listed in KNOWN_DIFFERENCES so any other drift fails the build.
import { describe, it, expect } from "vitest";
import spec from "@/docs/client-spec-v1.json";
import { finalSpec, EMPTY } from "@/lib/resolve";

const ours = finalSpec(EMPTY);
const theirs = spec.spec;

// screen ids we renamed, and labels we corrected on purpose
const SCREEN_ID = { profile: "dispatch_register" };
const KNOWN_DIFFERENCES = {
  menuLabels: { Complaince: "Compliance" },          // spelling fixed
  screenTitles: { profile: "Dispatch Register" },     // was "Contractor Profile" under a "Dispatch Register" menu
};

const labels = (block) => block.items.map((i) => i.label);

describe("menu", () => {
  it("has the client's groups in the client's order", () => {
    const expected = theirs.menu.map((g) => KNOWN_DIFFERENCES.menuLabels[g.label] ?? g.label);
    expect(ours.menu.map((g) => g.label)).toEqual(expected);
  });
  it("has the client's items under each group", () => {
    for (const g of theirs.menu) {
      const mine = ours.menu.find((x) => x.label === (KNOWN_DIFFERENCES.menuLabels[g.label] ?? g.label));
      expect(mine?.items?.map((i) => i.label) ?? [], g.label).toEqual((g.items ?? []).map((i) => i.label));
    }
  });
});

describe("screens", () => {
  for (const screen of theirs.screens) {
    const id = SCREEN_ID[screen.id] ?? screen.id;
    describe(id, () => {
      const mine = ours.screens.find((s) => s.id === id);
      it("exists", () => expect(mine).toBeDefined());
      it("has the agreed title", () => {
        expect(mine.title).toBe(KNOWN_DIFFERENCES.screenTitles[screen.id] ?? screen.title);
      });
      it("has the same sections, fields and columns, in order", () => {
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
    });
  }
});
