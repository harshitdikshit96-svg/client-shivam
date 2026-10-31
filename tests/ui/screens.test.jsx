// Renders screens the way the client will see them (final mode, no customize controls).
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustProvider } from "@/components/Cust";
import PageView from "@/components/PageView";
import Sidebar from "@/components/Sidebar";
import { SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";

const renderFinal = (ui) =>
  render(<CustProvider k={null} initial={{ overrides: EMPTY, status: "final" }}>{ui}</CustProvider>);

describe("Wage Entry: type days, everything calculates", () => {
  const setup = () => renderFinal(<PageView screen={SCREEN_BY_ID.wage_entry} go={() => {}} />);
  const cell = (id) => screen.getByTestId(`calc-${id}`).textContent;

  it("shows the client's August example (26 days × ₹556) on load", () => {
    setup();
    expect(cell("gross")).toBe("14,456.00");
    expect(cell("epf")).toBe("1,735.00");
    expect(cell("esi")).toBe("108.00");
    expect(cell("net")).toBe("12,613.00");
  });

  it("recalculates as soon as days are changed", async () => {
    setup();
    const days = screen.getByLabelText("Days Worked");
    await userEvent.clear(days);
    await userEvent.type(days, "21");
    expect(cell("gross")).toBe("11,676.00");
    expect(cell("net")).toBe("10,187.00");
  });

  it("adds overtime and extras", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("OT Hrs"), "2");
    await userEvent.selectOptions(screen.getByLabelText("OT Min"), "30");
    await userEvent.type(screen.getByLabelText("Bonus"), "500");
    expect(cell("ot")).toBe("347.50");
    expect(cell("gross")).toBe("15,303.50");
  });

  it("explains impossible input", async () => {
    setup();
    const days = screen.getByLabelText("Days Worked");
    await userEvent.clear(days);
    await userEvent.type(days, "40");
    expect(screen.getByRole("alert")).toHaveTextContent(/daysWorked must be 0–31/);
  });

  it("has Fine and CMPS Deduction columns for the office to type (CR-9; CR-1 had removed them)", () => {
    setup();
    const header = screen.getByRole("table").querySelector("thead");
    expect(within(header).getByText("Fine")).toBeInTheDocument();
    expect(within(header).getByText("CMPS Deduction")).toBeInTheDocument();
  });
});

describe("Work order Config", () => {
  it("shows a per-day wage row for each skill category and default deductions", () => {
    renderFinal(<PageView screen={SCREEN_BY_ID.wo_new} go={() => {}} />);
    for (const s of ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"]) {
      expect(screen.getByLabelText(`${s} Per Day Wage (₹)`)).toBeInTheDocument();
    }
    expect(screen.getAllByDisplayValue("12").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("0.75").length).toBeGreaterThan(0);
  });
});

describe("Edit Workmen form", () => {
  it("shows the agreed fields and none of the removed ones", () => {
    renderFinal(<PageView screen={SCREEN_BY_ID.wm_edit} go={() => {}} />);
    for (const label of ["Aadhaar", "Address", "Accommodation", "Wage Category"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    for (const gone of ["LWF", "Service Book No", "Permanent Address", "Social Category"]) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByTitle("Hide")).toBeNull();
  });
});

describe("Sidebar", () => {
  it("lists the client's menu in order, Home first (CR-2), with no Attendance group", () => {
    renderFinal(<Sidebar screen="home" go={() => {}} />);
    const text = screen.getByRole("navigation").textContent;
    expect(text.startsWith("Home")).toBe(true);
    const order = ["Home", "Work Order", "Workmen", "Wages", "Compliance", "Logout"].map((l) => text.indexOf(l));
    expect(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))).toBe(true);
    expect(text).not.toContain("Attendance");
  });
});

describe("Logout", () => {
  it("is not a dead click: it goes through the app's navigation", async () => {
    const go = vi.fn();
    renderFinal(<Sidebar screen="home" go={go} />);
    await userEvent.click(screen.getByText("Logout"));
    expect(go).toHaveBeenCalledWith("logout");
  });
});
