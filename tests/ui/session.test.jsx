// Logged out → full-screen home page with the login; logged in → the portal on Home; Logout → back.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/components/App";
import { createTestDb } from "../helpers/db";
import { loadDemoData } from "@/lib/demo";
import { firmSnapshot } from "@/lib/data";
import { login, logout, sessionUser, setLogin, resetThrottle } from "@/lib/session";
import { UserError } from "@/lib/ops";

let t, token;
beforeAll(async () => {
  t = await createTestDb();
  await loadDemoData(t.db);
  await setLogin(t.db, { username: "owner", password: "correct-horse" });
}, 60000);
afterAll(async () => { await t.close(); });

// a tiny stand-in for the server: /api/session and /api/data backed by the test database, cookie kept in `token`
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => {
  token = null;
  resetThrottle();
  history.replaceState(null, "", "/");
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? "GET";
    if (url.startsWith("/api/session")) {
      if (method === "GET") {
        const u = await sessionUser(t.db, token);
        return json(200, { loggedIn: !!u, username: u?.username ?? null, hasLogin: true });
      }
      if (method === "DELETE") { await logout(t.db, token); token = null; return json(200, { loggedIn: false }); }
      try {
        const body = JSON.parse(opts.body);
        const r = await login(t.db, { ...body, address: "test" });
        token = r.token;
        return json(200, { loggedIn: true, username: r.user.username });
      } catch (e) {
        if (e instanceof UserError) return json(400, { error: e.message, fields: e.fields });
        throw e;
      }
    }
    if (url.startsWith("/api/data")) {
      if (!(await sessionUser(t.db, token))) return json(401, { error: "You have been logged out. Please log in again.", loggedOut: true });
      return json(200, await firmSnapshot(t.db, Number(new URL(url, "http://x").searchParams.get("firm")) || null));
    }
    return json(404, {});
  });
});

const logIn = async (password = "correct-horse") => {
  await userEvent.type(await screen.findByLabelText("Username"), "owner");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
};

describe("logged out", () => {
  it("shows the full-screen home page with the login, and nothing of the portal", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText(/All your firms, work orders, workmen and wages/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main menu" })).toBeNull();
    expect(screen.queryByLabelText("Select firm")).toBeNull();
    expect(global.fetch.mock.calls.some(([u]) => u.startsWith("/api/data"))).toBe(false);
  });
  it("a wrong password says so and clears the password", async () => {
    render(<App />);
    await logIn("wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("The username or password is not correct.");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
  it("Forgot password? explains how the password is reset", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    expect(screen.getByText(/reset by your administrator/)).toBeInTheDocument();
  });
});

describe("logged in", () => {
  it("opens the portal on Home: firm switcher, menu with Home first, the dashboard", async () => {
    render(<App />);
    await logIn();
    const nav = await screen.findByRole("navigation", { name: "Main menu" });
    expect(nav.textContent.startsWith("Home")).toBe(true);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Contractor Dashboard for CUIN/));
    expect(screen.getByLabelText("Select firm")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });
  it("Logout (top bar) returns to the full-screen home page", async () => {
    render(<App />);
    await logIn();
    await screen.findByRole("navigation", { name: "Main menu" });
    await userEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("You have logged out.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main menu" })).toBeNull();
    expect(token).toBeNull();
  });
  it("Logout in the menu does the same", async () => {
    render(<App />);
    await logIn();
    const nav = await screen.findByRole("navigation", { name: "Main menu" });
    await userEvent.click(within(nav).getByText("Logout"));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });
  it("if the session ends elsewhere, the next data load goes back to the login", async () => {
    render(<App />);
    await logIn();
    await screen.findByRole("navigation", { name: "Main menu" });
    await logout(t.db, token);                       // e.g. the password was changed on another computer
    await userEvent.selectOptions(screen.getByLabelText("Select firm"), await screen.findByRole("option", { name: "Demo Manpower Agency" }));
    expect(await screen.findByText("Your session has ended. Please log in again.")).toBeInTheDocument();
  });
});
