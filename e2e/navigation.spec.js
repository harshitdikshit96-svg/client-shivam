import { test, expect } from "@playwright/test";

test("home loads with the client's menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-title")).toContainText("Contractor Dashboard");
  for (const item of ["Work Order", "Home", "Workmen", "Wages", "Compliance", "Logout"]) {
    await expect(page.getByRole("navigation")).toContainText(item);
  }
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

test("Create New Work Order opens the new work order form", async ({ page }) => {
  await page.goto("/#s=wo_ongoing");
  await page.getByRole("button", { name: "Create New Work Order" }).click();
  await expect(page.locator(".page-title")).toHaveText("New Work Order / Contract");
  await expect(page.getByText("Party GST Number")).toBeVisible();
});
