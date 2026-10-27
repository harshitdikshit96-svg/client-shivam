// Work Location (District) suggests the districts of the chosen State; any name can still be typed in.
import { describe, it, expect } from "vitest";
import { DISTRICTS, districtsOf } from "@/lib/districts";
import { checkValue } from "@/lib/validate";
import { SCREEN_BY_ID } from "@/lib/schema";

const field = (screen, id) => SCREEN_BY_ID[screen].blocks.flatMap((b) => b.items).find((i) => i.id === id);

describe("districts", () => {
  it("every State in the drop-down has its districts", () => {
    for (const screen of ["wo_new", "wo_edit"]) {
      for (const s of field(screen, "state").options) expect(districtsOf(s).length, s).toBeGreaterThan(0);
    }
  });
  it("every district name passes the District format, with no repeats within a State", () => {
    for (const [s, list] of Object.entries(DISTRICTS)) {
      expect(new Set(list).size, s).toBe(list.length);
      for (const d of list) expect(checkValue("place", d), `${s}: ${d}`).toBeNull();
    }
  });
  it("the District field takes suggestions from the State and is not limited to them", () => {
    for (const screen of ["wo_new", "wo_edit"]) {
      const d = field(screen, "district");
      expect(d.suggestFrom).toBe("state");
      expect(d.input).toBeUndefined();   // a text field with suggestions, not a fixed select
    }
    expect(districtsOf("Uttar Pradesh")).toContain("Lucknow");
    expect(districtsOf("Nowhere")).toEqual([]);
  });
});
