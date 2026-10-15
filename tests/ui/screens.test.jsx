// Renders screens the way the client will see them (final mode, no customize controls).
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustProvider } from "@/components/Cust";
import PageView from "@/components/PageView";
import Sidebar from "@/components/Sidebar";
import { SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";

const renderFinal = (ui) =>
  render(<CustProvider k={null} initial={{ overrides: EMPTY, status: "final" }}>{ui}</CustProvider>);

describe("Edit Workmen form", () => {
  it("shows the agreed fields and none of the removed ones", () => {
    renderFinal(<PageView screen={SCREEN_BY_ID.wm_edit} go={() => {}} />);
    for (const label of ["Aadhaar", "Address", "Accommodation", "Wage Category", "Nominee Name"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const gone of ["LWF", "Service Book No", "Permanent Address", "Social Category", "Place of Work", "Reason of Exit"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });
  it("shows no customize controls", () => {
    renderFinal(<PageView screen={SCREEN_BY_ID.wm_edit} go={() => {}} />);
    expect(screen.queryByTitle("Hide")).toBeNull();
    expect(screen.queryByTitle("Rename")).toBeNull();
  });
});

describe("Wage Entry grid", () => {
  it("has no Fine or CMPS columns and marks calculated columns", () => {
    renderFinal(<PageView screen={SCREEN_BY_ID.wage_entry} go={() => {}} />);
    const header = screen.getByRole("table").querySelector("thead");
    expect(within(header).queryByText("Fine")).toBeNull();
    expect(within(header).queryByText("CMPS Deduction")).toBeNull();
    expect(within(header).getByText("Net Earnings")).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  it("lists the client's menu in order", () => {
    renderFinal(<Sidebar screen="home" go={() => {}} />);
    const text = screen.getByRole("navigation").textContent;
    const order = ["Work Order", "Home", "Workmen", "Wages", "Compliance", "Logout"].map((l) => text.indexOf(l));
    expect(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))).toBe(true);
    expect(text).not.toContain("Attendance");
  });
  it("navigates to the Dispatch Register", async () => {
    const visited = [];
    renderFinal(<Sidebar screen="home" go={(id) => visited.push(id)} />);
    await userEvent.click(screen.getByText("Compliance"));
    await userEvent.click(screen.getByText("Dispatch Register"));
    expect(visited).toContain("dispatch_register");
  });
});
