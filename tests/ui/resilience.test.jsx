// When things go wrong the user is told what happened and what to do — never a blank page or a silent click.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustProvider } from "@/components/Cust";
import { DataProvider } from "@/components/Data";
import PageView from "@/components/PageView";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SCREEN_BY_ID } from "@/lib/schema";
import { EMPTY } from "@/lib/resolve";

const FIRM = { id: 1, name: "Firm", cuin: "C1" };
const DATA = { firms: [FIRM], firm: FIRM, workOrders: [], workmen: [], engagements: [], sheets: [], bills: [], activity: [] };

function renderWith(fetchImpl, screenId = "create_firm", params = { edit: 1 }) {
  global.fetch = vi.fn(fetchImpl);
  const onLoggedOut = vi.fn();
  render(
    <CustProvider k={null} initial={{ overrides: EMPTY, status: "final" }}>
      <DataProvider initialData={DATA} onLoggedOut={onLoggedOut}>
        <PageView screen={SCREEN_BY_ID[screenId]} go={() => {}} params={params} />
      </DataProvider>
    </CustProvider>,
  );
  return { onLoggedOut };
}
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const firmForm = { form: { name: "Firm" } };

beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });

describe("server trouble while saving", () => {
  it("no connection: says nothing was saved, keeps what was typed", async () => {
    renderWith(async (url, o) => (o?.method === "POST" && JSON.parse(o.body).op === "getFirm" ? res(200, { result: firmForm }) : Promise.reject(new TypeError("Failed to fetch"))));
    await waitFor(() => expect(screen.getByLabelText("Firm Name")).toHaveValue("Firm"));
    await userEvent.type(screen.getByLabelText("CUIN"), "NEW-1");
    await userEvent.click(screen.getByRole("button", { name: "Save Firm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server, so nothing was saved");
    expect(screen.getByLabelText("CUIN")).toHaveValue("NEW-1");
  });
  it("server error (500): says nothing was changed, without technical detail", async () => {
    renderWith(async (url, o) => (JSON.parse(o.body).op === "getFirm" ? res(200, { result: firmForm }) : { ok: false, status: 500, json: async () => { throw new Error("not json"); } }));
    await waitFor(() => expect(screen.getByLabelText("Firm Name")).toHaveValue("Firm"));
    await userEvent.click(screen.getByRole("button", { name: "Save Firm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The server had a problem and nothing was changed");
  });
  it("session ended while working: back to the login page", async () => {
    const { onLoggedOut } = renderWith(async (url, o) => (JSON.parse(o.body).op === "getFirm" ? res(200, { result: firmForm }) : res(401, { error: "You have been logged out. Please log in again.", loggedOut: true })));
    await waitFor(() => expect(screen.getByLabelText("Firm Name")).toHaveValue("Firm"));
    await userEvent.click(screen.getByRole("button", { name: "Save Firm" }));
    await waitFor(() => expect(onLoggedOut).toHaveBeenCalled());
  });
  it("a refused action names the problem field and offers the fix", async () => {
    renderWith(async (url, o) => (JSON.parse(o.body).op === "getFirm" ? res(200, { result: firmForm })
      : res(400, { error: "A firm with this name already exists.", fields: { "form.name": "A firm with this name already exists." } })));
    await waitFor(() => expect(screen.getByLabelText("Firm Name")).toHaveValue("Firm"));
    await userEvent.click(screen.getByRole("button", { name: "Save Firm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A firm with this name already exists.");
    expect(screen.getByLabelText("Firm Name")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("a screen that fails to draw", () => {
  it("shows a message with Go to Home instead of a blank page", async () => {
    const Broken = () => { throw new Error("boom"); };
    const home = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary onHome={home}><Broken /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("This screen ran into a problem");
    await userEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    expect(home).toHaveBeenCalled();
  });
});
