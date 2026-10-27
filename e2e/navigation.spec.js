// A real browser against the production build, starting from an EMPTY database:
// the user is guided from "no firm" to submitted wages, and every step is done through the screens.
import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const notice = (page) => page.locator(".notice");
const USER = "e2e-owner";
let password = "e2e-password-1";   // changed by the Reset Password test

/** Every test starts logged out (fresh browser); log in, then open the screen. */
async function open(page, hash = "") {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Main menu" });
  await expect(page.getByLabel("Username").or(menu)).toBeVisible();
  if (await menu.isVisible()) { if (hash) await page.goto(`/#${hash}`); return; }   // still logged in
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  if (hash) await page.goto(`/#${hash}`);
}

test("logged out: full-screen home page with the login; a wrong password is refused", async ({ page }) => {
  await page.goto("/#s=wo_ongoing");   // a deep link while logged out still shows the login
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toHaveCount(0);
  const r = await page.request.get("/api/data");
  expect(r.status()).toBe(401);
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator(".landing-card").getByRole("alert")).toContainText("The username or password is not correct.");
});

test("after login: Home is the first screen; with no firm it says to create one", async ({ page }) => {
  await open(page);
  await expect(page.locator(".page-title")).toContainText("Contractor Dashboard");
  await expect(page.getByRole("navigation").locator(".menu-head").first()).toHaveText("Home");
  await expect(page.getByRole("note")).toContainText("No firm yet");
  await page.getByRole("note").getByRole("button", { name: "Create Firm" }).click();
  await expect(page.locator(".page-title")).toHaveText("Create Firm");
});

test("create a firm: missing name is marked, then the firm is created and selected", async ({ page }) => {
  await open(page, "s=create_firm");
  await page.getByRole("main").getByRole("button", { name: "Create Firm" }).click();
  await expect(notice(page)).toContainText("Please correct the highlighted fields");
  await expect(page.locator(".field-error").first()).toHaveText("Required");
  await page.getByLabel("Firm Name").fill("E2E Security Services");
  await page.getByLabel("CUIN").fill("E2E-1");
  await page.getByRole("main").getByRole("button", { name: "Create Firm" }).click();
  await expect(notice(page)).toContainText('Firm "E2E Security Services" created');
  await expect(page.getByLabel("Select firm")).toHaveValue(/\d+/);
  await expect(page.locator(".page-title")).toContainText("E2E-1");
  await expect(page.getByText("Getting started")).toBeVisible();
});

test("new work order: no Firm field; created, then approved", async ({ page }) => {
  await open(page, "s=wo_new");
  await expect(page.getByText("will be saved under E2E Security Services")).toBeVisible();
  await expect(page.getByLabel("Firm", { exact: true })).toHaveCount(0);
  const f = (label, v) => page.getByLabel(label, { exact: true }).fill(v);
  await f("Work Order Number", "E2E-WO-1");
  await f("Name of the Work", "Sweeping");
  await f("Name of the Principal Employer", "PE");
  await f("Date of Commencement", "2026-06-01");
  await f("Designation of the Principal Employer", "Manager");
  await f("Date of Completion", "2027-03-31");
  await f("Company", "NEC");
  await f("Contact Details of Principal Employer", "9000000000");
  await page.getByLabel("Work Location (State)", { exact: true }).selectOption("Assam");
  await f("Work Location (District)", "Tinsukia");
  await page.getByLabel("Unskilled Per Day Wage (₹)").fill("556");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(notice(page)).toContainText("E2E-WO-1 created and waiting for approval");
  await expect(page.locator(".page-title")).toHaveText("Work Order — E2E-WO-1");
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(notice(page)).toContainText("E2E-WO-1 approved");
});

test("new workman: Aadhaar is typed here; then engaged on the work order", async ({ page }) => {
  await open(page, "s=wm_engage");
  await page.getByRole("button", { name: "New Workman" }).first().click();
  await expect(page.locator(".page-title")).toHaveText("New Workman");
  const f = (label, v) => page.getByLabel(label, { exact: true }).first().fill(v);
  await f("Aadhaar", "123412341234");
  await f("Name", "Ramesh");
  await page.getByLabel("Gender", { exact: true }).selectOption("Male");
  await f("Father's/Mother's/Spouse Name", "Suresh");
  await f("Date of Birth", "1990-01-01");
  await f("Date of Joining", "2026-06-01");
  await f("Designation", "LABOUR");
  await page.getByLabel("Skill Category", { exact: true }).selectOption("Unskilled");
  await f("Bank A/C Number", "000111222333");
  await f("Address", "Margherita");
  await page.getByRole("button", { name: "Add Workman" }).click();
  await expect(notice(page)).toContainText("Workman added with WUIN WM00001");

  await expect(page.locator(".page-title")).toHaveText("Engage Workmen against Work Order");
  await page.getByLabel("Work Order", { exact: true }).selectOption({ label: "E2E-WO-1 — Sweeping" });
  await page.getByLabel("New engagement from for WM00001").fill("2026-07-01");
  await page.getByRole("button", { name: "Engage Selected" }).click();
  await expect(notice(page)).toContainText("1 workman engaged on E2E-WO-1");
});

test("wage entry: choose the order and month, type days, save, submit", async ({ page }) => {
  await open(page, "s=wage_new");
  await page.getByLabel("Year").selectOption("2026");
  await page.getByLabel("Month").selectOption("August");
  await page.getByRole("button", { name: "Wage Entry" }).click();
  await expect(page.getByLabel("Work Order", { exact: true })).toHaveValue(/\d+/);
  await page.getByLabel("Days Worked WM00001").fill("26");
  await expect(page.locator(".totals-row")).toContainText("12,613.00");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(notice(page)).toContainText("Saved wages of 1 workman for August 2026");
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(notice(page)).toContainText("submitted and locked");
  await open(page, "s=wage_submitted");
  await page.getByLabel("Month").selectOption("August");
  await expect(page.getByRole("cell", { name: "E2E-WO-1" })).toBeVisible();
});

test("an existing workman's Aadhaar can be corrected; letters cannot be typed, a short one is refused", async ({ page }) => {
  await open(page, "s=wm_active");
  await page.getByRole("button", { name: "WM00001" }).click();
  await page.getByRole("button", { name: "Edit Workman" }).click();
  const aadhaar = page.getByLabel("Aadhaar", { exact: true }).first();
  await expect(aadhaar).toHaveValue("123412341234");
  await aadhaar.fill("");
  await aadhaar.pressSequentially("9876abc5");
  await expect(aadhaar).toHaveValue("98765");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(notice(page)).toContainText("Please correct the highlighted fields");
  await expect(page.locator(".field-error").first()).toContainText("12 digits");
  await aadhaar.fill("987654321098");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(notice(page)).toContainText("Workman WM00001 saved");
});

test("every menu screen opens", async ({ page }) => {
  await open(page);
  const flows = [
    ["Work Order", "Ongoing Work Order", "Ongoing Work Orders / Contracts"],
    ["Workmen", "View Active Workmen", "Active Workmen"],
    ["Wages", "New Wage Entry", "New Wage Entry"],
    ["Wages", "Approved Wages", "Approved Wages"],
    ["Compliance", "Dispatch Register", "Dispatch Register"],
  ];
  for (const [group, item, title] of flows) {
    const sub = page.getByRole("navigation").getByText(item, { exact: true });
    if (!(await sub.isVisible())) await page.getByRole("navigation").getByText(group, { exact: true }).click();
    await sub.click();
    await expect(page.locator(".page-title")).toHaveText(title);
  }
});

test("Reset Password: the old password stops working, the new one works", async ({ page }) => {
  await open(page, "s=reset_pw");
  await page.getByLabel("Current Password").fill(password);
  await page.getByLabel("New Password", { exact: true }).fill("e2e-password-2");
  await page.getByLabel("Confirm New Password").fill("e2e-password-2");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(notice(page)).toContainText(`Password changed for login "${USER}"`);
  password = "e2e-password-2";
  await page.getByRole("banner").getByRole("button", { name: "Logout" }).click();
  await expect(page.getByText("You have logged out.")).toBeVisible();
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator(".landing-card").getByRole("alert")).toContainText("not correct");
  await open(page);
  await expect(page.locator(".page-title")).toContainText("Contractor Dashboard");
});

test("Logout returns to the full-screen home page and the data is closed again", async ({ page }) => {
  await open(page, "s=wm_active");
  await page.getByRole("navigation").getByText("Logout", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toHaveCount(0);
  expect((await page.request.get("/api/data")).status()).toBe(401);
});
