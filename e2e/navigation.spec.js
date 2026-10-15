import { test, expect } from "@playwright/test";

test("home loads with the client's menu and Create Firm on top", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-title")).toContainText("Contractor Dashboard");
  for (const item of ["Work Order", "Home", "Workmen", "Wages", "Compliance", "Logout"]) {
    await expect(page.getByRole("navigation")).toContainText(item);
  }
  await page.getByRole("button", { name: "Create Firm" }).click();
  await expect(page.locator(".page-title")).toHaveText("Create Firm");
});

test("every menu screen opens", async ({ page }) => {
  await page.goto("/");
  const flows = [
    ["Work Order", "Ongoing Work Order", "Ongoing Work Orders / Contracts"],
    ["Workmen", "View Active Workmen", "Active Workmen"],
    ["Wages", "New Wage Entry", "New Wage Entry"],
    ["Compliance", "Dispatch Register", "Dispatch Register"],
  ];
  for (const [group, item, title] of flows) {
    await page.getByRole("navigation").getByText(group, { exact: true }).click();
    await page.getByRole("navigation").getByText(item, { exact: true }).click();
    await expect(page.locator(".page-title")).toHaveText(title);
  }
});

test("new work order has Firm and Config", async ({ page }) => {
  await page.goto("/#s=wo_ongoing");
  await page.getByRole("button", { name: "Create New Work Order" }).click();
  await expect(page.locator(".page-title")).toHaveText("New Work Order / Contract");
  await expect(page.getByText("Config — Per Day Wages")).toBeVisible();
  await expect(page.getByLabel("Unskilled Per Day Wage (₹)")).toBeVisible();
});

test("wage entry calculates from the days typed", async ({ page }) => {
  await page.goto("/#s=wage_entry");
  await page.getByLabel("Days Worked").fill("25");
  await expect(page.getByTestId("calc-gross")).toHaveText("13,900.00");
  await expect(page.getByTestId("calc-net")).toHaveText("12,128.00");
});
