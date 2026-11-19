// Public website layout across screen sizes: the phone menu covers the page, and nothing scrolls sideways.
import { test, expect } from "@playwright/test";

const PAGES = ["/", "/about", "/companies", "/companies/akhya-security-services", "/services", "/partners", "/careers", "/contact", "/privacy"];

for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768]]) {
  test(`phone menu opens over the page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.locator("#hp-menu");
    await expect(menu).toBeVisible();
    // fills the screen below the header and sits on top of the page
    const box = await menu.boundingBox();
    expect(box.y + box.height).toBeGreaterThanOrEqual(height - 1);
    const first = menu.getByRole("link").first();
    const fb = await first.boundingBox();
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("#hp-menu"), [fb.x + 5, fb.y + 5])).toBe(true);
    // the last item can be reached
    const login = menu.getByRole("link", { name: "Login" });
    await login.scrollIntoViewIfNeeded();
    await expect(login).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(wide, path).toBeLessThanOrEqual(0);
    }
  });
}

test("home hero carousel: fades on its own, dots pick a slide, pause stops it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Our business verticals" });
  const label = hero.locator(".hp-slide-label");
  await expect(label).toContainText("01 / 06");
  await expect(hero.locator(".hp-slides img.hp-on")).toHaveCount(1);
  // moves on by itself (mouse kept off the hero, which pauses it)
  await page.mouse.move(5, 5);
  await expect(label).toContainText("02 / 06", { timeout: 8000 });
  await hero.getByRole("button", { name: "Show slide 4: Healthcare & Wellness" }).click();
  await expect(label).toContainText("Healthcare & Wellness");
  await expect(hero.getByRole("button", { name: /Show slide 4/ })).toHaveAttribute("aria-current", "true");
  await hero.getByRole("button", { name: "Pause slideshow" }).click();
  await page.mouse.click(5, 5); // focus and mouse off the hero, so only the pause button holds it
  await page.waitForTimeout(6500);
  await expect(label).toContainText("04 / 06");
  await hero.getByRole("button", { name: "Play slideshow" }).click();
  await page.mouse.click(5, 5);
  await expect(label).toContainText("05 / 06", { timeout: 8000 });
  // the hero text and buttons are unchanged
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Building Businesses. Creating Opportunities.");
  for (const name of ["Explore Our Companies", "Partner With Us", "Contact Us"]) await expect(hero.getByRole("link", { name })).toBeVisible();
});
