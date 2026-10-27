// ERP test plan (docs/TEST-PLAN.md), UI level: every creation form saves the record, the record appears in
// the right lists with the right links (firm → work order → workman → wages → bill), and it can be edited.
// Runs after navigation.spec.js on the same database, so it works under its own two firms.
import { test, expect } from "@playwright/test";

// in order on one worker; a failing case does not stop the rest (they record defects, not setup steps)
test.describe.configure({ mode: "default" });

const USER = "e2e-owner";
const FIRM_A = "Alpha Workflow Services";
const FIRM_B = "Beta Workflow Services";
const notice = (page) => page.locator(".notice");
const main = (page) => page.getByRole("main");

async function login(page) {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Main menu" });
  await expect(page.getByLabel("Username").or(menu)).toBeVisible();
  if (await menu.isVisible()) return;
  for (const pw of ["e2e-password-2", "e2e-password-1"]) {   // navigation.spec.js changes the password
    await page.getByLabel("Username").fill(USER);
    await page.getByLabel("Password").fill(pw);
    await page.getByRole("button", { name: "Log in" }).click();
    const ok = await menu.waitFor({ timeout: 5000 }).then(() => true, () => false);
    if (ok) return;
  }
  await expect(menu).toBeVisible();
}

/** Log in, pick the firm in the top bar, open a screen. */
async function open(page, firm, hash = "") {
  await login(page);
  if (firm) {
    const sel = page.getByLabel("Select firm");
    if ((await sel.locator("option:checked").textContent()) !== firm) {
      await sel.selectOption({ label: firm });
      await expect(page.locator(".page-title")).toContainText("Contractor Dashboard");
      await page.waitForLoadState("networkidle");
    }
  }
  if (hash) await go(page, hash);
}

/** Open a screen by its hash and wait until it is the one showing. */
async function go(page, hash) {
  const screen = new URLSearchParams(hash).get("s");
  await page.goto(`/#${hash}`);
  await page.waitForLoadState("networkidle");
  // a firm switch can still send the app back to Home: open the screen again if so
  if (!page.url().includes(`s=${screen}`)) await page.goto(`/#${hash}`);
  await expect(page).toHaveURL(new RegExp(`s=${screen}`));
}

/** The firm's data as the screens get it (ids for deep links, and to check the links between records). */
async function data(page, firm) {
  const all = await (await page.request.get("/api/data")).json();
  const id = all.firms.find((f) => f.name === firm).id;
  return (await page.request.get(`/api/data?firm=${id}`)).json();
}

/** Choose the option of a drop-down whose text contains `text`. */
async function pick(select, text) {
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  await select.selectOption(value);
}

const fill = (page, label, v) => main(page).getByLabel(label, { exact: true }).first().fill(v);

async function newOrder(page, woNo, rate) {
  await go(page, "s=wo_new");
  await fill(page, "Work Order Number", woNo);
  await fill(page, "Name of the Work", "Housekeeping");
  await fill(page, "Name of the Principal Employer", "PE");
  await fill(page, "Date of Commencement", "2026-06-01");
  await fill(page, "Designation of the Principal Employer", "Manager");
  await fill(page, "Date of Completion", "2027-03-31");
  await fill(page, "Company", "NEC");
  await fill(page, "Contact Details of Principal Employer", "9000000000");
  await main(page).getByLabel("Work Location (State)", { exact: true }).selectOption("Assam");
  await fill(page, "Work Location (District)", "Tinsukia");
  await main(page).getByLabel("Unskilled Per Day Wage (₹)").fill(rate);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(notice(page)).toContainText(`${woNo} created and waiting for approval`);
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(notice(page)).toContainText(`${woNo} approved`);
}

test("UI-01 Create Firm (navbar) creates two firms, each selectable in the top bar", async ({ page }) => {
  await login(page);
  for (const [name, cuin] of [[FIRM_A, "WF-A"], [FIRM_B, "WF-B"]]) {
    await go(page, "s=create_firm");
    await fill(page, "Firm Name", name);
    await fill(page, "CUIN", cuin);
    await main(page).getByRole("button", { name: "Create Firm" }).click();
    await expect(notice(page)).toContainText(`Firm "${name}" created`);
    await expect(page.getByLabel("Select firm").locator("option:checked")).toHaveText(name);
  }
  const all = await (await page.request.get("/api/data")).json();
  expect(all.firms.map((f) => f.name)).toEqual(expect.arrayContaining([FIRM_A, FIRM_B]));
});

test("UI-02 New Work Order + approve: listed under Ongoing of firm A only, with the firm and 0 workmen", async ({ page }) => {
  await open(page, FIRM_A);
  await newOrder(page, "WF-WO-1", "556");
  await go(page, "s=wo_ongoing");
  const row = main(page).getByRole("row").filter({ hasText: "WF-WO-1" });
  await expect(row).toBeVisible();
  const d = await data(page, FIRM_A);
  expect(d.workOrders.find((o) => o.woNo === "WF-WO-1")).toMatchObject({ status: "approved", firm: FIRM_A, workmenCount: 0 });
  expect((await data(page, FIRM_B)).workOrders).toHaveLength(0);
});

test("UI-03 Edit Work Order: the edit form loads the saved values; the change shows in the view", async ({ page }) => {
  await open(page, FIRM_A);
  const wo = (await data(page, FIRM_A)).workOrders.find((o) => o.woNo === "WF-WO-1");
  await go(page, `s=wo_edit&wo=${wo.id}`);
  await expect(main(page).getByLabel("Name of the Work", { exact: true }).last()).toHaveValue("Housekeeping");
  await expect(main(page).getByLabel("Unskilled Per Day Wage (₹)")).toHaveValue(/556/);
  await main(page).getByLabel("Name of the Work", { exact: true }).last().fill("Housekeeping and Sweeping");
  await main(page).getByLabel(/^Name of the supervisor/).fill("Mohan Lal");
  await main(page).getByLabel(/^Contact Number of the Supervisor/).fill("9111111111");
  await main(page).getByLabel("Nature of Work", { exact: true }).selectOption("Watch and Ward");
  await main(page).getByLabel("Area of Operation", { exact: true }).selectOption("Surface");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(notice(page)).toContainText("WF-WO-1");
  await go(page, `s=wo_view&wo=${wo.id}`);
  await expect(main(page)).toContainText("Housekeeping and Sweeping");
  await expect(main(page)).toContainText("Mohan Lal");
});

test("UI-04 Config: a new Per Day Wage is saved and shown when Config is opened again", async ({ page }) => {
  await open(page, FIRM_A);
  const wo = (await data(page, FIRM_A)).workOrders.find((o) => o.woNo === "WF-WO-1");
  await go(page, `s=wo_config&wo=${wo.id}`);
  await main(page).getByLabel("Unskilled Per Day Wage (₹)").fill("600");
  await page.getByRole("button", { name: "Save Config" }).click();
  await expect(notice(page)).toBeVisible();
  await page.reload();
  await expect(main(page).getByLabel("Unskilled Per Day Wage (₹)")).toHaveValue(/600/);
  expect((await data(page, FIRM_A)).workOrders.find((o) => o.woNo === "WF-WO-1").config.rates.Unskilled.basicDaily).toBe(600);
});

test("UI-05 New Workman → engaged on WF-WO-1: Active list, workman page and order page all show the link", async ({ page }) => {
  await open(page, FIRM_A, "s=wm_engage");
  await page.getByRole("button", { name: "New Workman" }).first().click();
  const f = (label, v) => main(page).getByLabel(label, { exact: true }).first().fill(v);
  await f("Aadhaar", "555566667777");
  await f("Name", "Kishan");
  await main(page).getByLabel("Gender", { exact: true }).selectOption("Male");
  await f("Father's/Mother's/Spouse Name", "Ram");
  await f("Date of Birth", "1992-05-05");
  await f("Date of Joining", "2026-06-01");
  await f("Designation", "LABOUR");
  await main(page).getByLabel("Skill Category", { exact: true }).selectOption("Unskilled");
  await f("Bank A/C Number", "000111222444");
  await f("Address", "Ledo");
  await page.getByRole("button", { name: "Add Workman" }).click();
  await expect(notice(page)).toContainText("Workman added with WUIN WM00001");   // numbering is per firm

  await pick(main(page).getByLabel("Work Order", { exact: true }), "WF-WO-1");
  await main(page).getByLabel("New engagement from for WM00001").fill("2026-07-01");
  await page.getByRole("button", { name: "Engage Selected" }).click();
  await expect(notice(page)).toContainText("1 workman engaged on WF-WO-1");

  await go(page, "s=wm_active");
  const row = main(page).getByRole("row").filter({ hasText: "WM00001" });
  await expect(row).toContainText("Kishan");
  await expect(row).toContainText("WF-WO-1");
  const d = await data(page, FIRM_A);
  const wo = d.workOrders.find((o) => o.woNo === "WF-WO-1");
  expect(wo.workmenCount).toBe(1);
  await go(page, `s=wo_view&wo=${wo.id}`);
  await expect(main(page).getByRole("row").filter({ hasText: "WM00001" })).toContainText("Kishan");
});

test("UI-06 Moving to WF-WO-2: the first engagement ends the day before; he is never on two orders", async ({ page }) => {
  await open(page, FIRM_A);
  await newOrder(page, "WF-WO-2", "556");
  await go(page, "s=wm_engage");
  await pick(main(page).getByLabel("Work Order", { exact: true }), "WF-WO-2");
  await main(page).getByLabel("New engagement from for WM00001").fill("2026-08-16");
  await page.getByRole("button", { name: "Engage Selected" }).click();
  await expect(notice(page)).toContainText("engaged on WF-WO-2");
  const d = await data(page, FIRM_A);
  const mine = d.engagements.filter((e) => e.wuin === "WM00001");
  expect(mine.map((e) => [e.woNo, e.from, e.to])).toEqual([["WF-WO-1", "2026-07-01", "2026-08-15"], ["WF-WO-2", "2026-08-16", null]]);
  expect(d.workOrders.map((o) => [o.woNo, o.workmenCount]).sort()).toEqual([["WF-WO-1", 0], ["WF-WO-2", 1]]);
  const w = d.workmen.find((x) => x.wuin === "WM00001");
  await go(page, `s=wm_view&wm=${w.id}`);
  const engRows = main(page).getByRole("row").filter({ hasText: /WF-WO-\d/ });
  await expect(engRows.filter({ hasText: "WF-WO-1" }).first()).toContainText("Ended");
  await expect(engRows.filter({ hasText: "WF-WO-2" }).first()).toContainText("Current");
});

test("UI-07 Edit engagement dates: an overlap with the other order is refused", async ({ page }) => {
  await open(page, FIRM_A);
  const d = await data(page, FIRM_A);
  const w = d.workmen.find((x) => x.wuin === "WM00001");
  await go(page, `s=wm_view&wm=${w.id}`);
  // ended engagements can be corrected too (Edit), but cannot be ended again (no End)
  const ended = main(page).getByRole("row").filter({ hasText: "WF-WO-1" }).first();
  await expect(ended.getByRole("button", { name: "Edit" })).toHaveCount(1);
  await expect(ended.getByRole("button", { name: "End" })).toHaveCount(0);
  const row = main(page).getByRole("row").filter({ hasText: "WF-WO-2" }).first();
  await row.getByRole("button", { name: "Edit" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Engaged From").fill("2026-08-01");   // would overlap WF-WO-1 (1 Jul – 15 Aug)
  await dlg.getByRole("button", { name: "Save dates" }).click();
  await page.waitForLoadState("networkidle");
  const after = (await data(page, FIRM_A)).engagements.find((e) => e.woNo === "WF-WO-2" && e.wuin === "WM00001");
  expect(after.from, "WF-WO-2 should still start on 16 Aug (1–15 Aug he was on WF-WO-1)").toBe("2026-08-16");
});

test("UI-08 Wage entry on WF-WO-2 is visible on the order page and the workman page", async ({ page }) => {
  await open(page, FIRM_A);
  const d = await data(page, FIRM_A);
  const wo = d.workOrders.find((o) => o.woNo === "WF-WO-2");
  await go(page, `s=wage_entry&wo=${wo.id}&y=2026&m=9`);
  await main(page).getByLabel("Days Worked WM00001").fill("26");
  await expect(page.locator(".totals-row")).toContainText("12,613.00");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(notice(page)).toContainText("Saved wages of 1 workman for September 2026");
  await go(page, `s=wo_view&wo=${wo.id}`);
  await expect(main(page).getByRole("row").filter({ hasText: /Sep/ }).first()).toContainText("12,613");
  const w = d.workmen.find((x) => x.wuin === "WM00001");
  await go(page, `s=wm_view&wm=${w.id}`);
  await expect(main(page).getByRole("row").filter({ hasText: /Sep/ }).first()).toContainText("WF-WO-2");
});

test("UI-09 Edit Workman: the new name shows in the lists and the wage lines", async ({ page }) => {
  await open(page, FIRM_A, "s=wm_active");
  await page.getByRole("button", { name: "WM00001" }).click();
  await page.getByRole("button", { name: "Edit Workman" }).click();
  await expect(main(page).getByLabel("Name", { exact: true }).first()).toHaveValue("Kishan");
  await main(page).getByLabel("Name", { exact: true }).first().fill("Kishan Lal");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(notice(page)).toContainText("Workman WM00001 saved");
  await go(page, "s=wm_active");
  await expect(main(page).getByRole("row").filter({ hasText: "WM00001" })).toContainText("Kishan Lal");
  const d = await data(page, FIRM_A);
  expect(d.sheets.find((s) => s.month === 9).lines[0].name).toMatch(/^Kishan Lal/);
});

test("UI-10 Dispatch Register: a new bill is listed with its order, then edited", async ({ page }) => {
  await open(page, FIRM_A, "s=dispatch_register");
  await page.getByRole("button", { name: "New Bill" }).click();
  await pick(main(page).getByLabel("Work Order", { exact: true }), "WF-WO-2");
  await fill(page, "Party Name / Contract Number", "NEC");
  await fill(page, "Bill Number", "WF-B-1");
  await fill(page, "Bill Date", "2026-10-01");
  await fill(page, "Taxable Amount", "50000");
  await page.getByRole("button", { name: /^(Add|Save) Bill$/ }).click();
  await expect(notice(page)).toBeVisible();
  const row = main(page).getByRole("row").filter({ hasText: "WF-B-1" });
  await expect(row).toContainText("WF-WO-2");
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(main(page).getByLabel("Bill Number", { exact: true })).toHaveValue("WF-B-1");
  await fill(page, "Received Amount", "45000");
  await fill(page, "Received Date", "2026-10-15");
  await page.getByRole("button", { name: /^(Add|Save) Bill$/ }).click();
  await expect(notice(page)).toBeVisible();
  const d = await data(page, FIRM_A);
  expect(d.bills.filter((b) => b.billNo === "WF-B-1")).toEqual([expect.objectContaining({ woNo: "WF-WO-2", received: 45000 })]);
});

test("UI-11 Switching to firm B shows none of firm A's records", async ({ page }) => {
  await open(page, FIRM_B, "s=wo_ongoing");
  await expect(main(page)).not.toContainText("WF-WO-1");
  await go(page, "s=wm_active");
  await expect(main(page)).not.toContainText("Kishan");
  await go(page, "s=dispatch_register");
  await expect(main(page)).not.toContainText("WF-B-1");
});
