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
    // same links as the desktop navbar
    await expect(menu.getByRole("link")).toHaveText(["About Us", "Our Companies", "Services", "Partners", "Careers", "Contact Us", "Login"]);
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

// Every form: an empty submit is blocked with a message per field; a filled-in one is sent to /api/site-form
// (intercepted here, so the test sends no email) and shows the thank-you message.
const FILLS = {
  "/careers": { form: "careers", submit: "Submit Your Resume", text: { "Full name": "Test Candidate", "Mobile number": "9876543210", "Email address": "test@example.com", "Preferred role": "Site Supervisor", Location: "Lucknow, UP", "Relevant experience": "Five years supervising security staff." }, file: ["Resume upload", "cv.pdf"], consent: true },
  "/vendor-registration": { form: "vendor", submit: "Register as a Vendor", text: { "Business or firm name": "Test Traders", "Contact person": "Test Vendor", "Mobile number": "9876543210", "Email address": "vendor@example.com", "Business address": "12 MG Road, Lucknow", "PAN and business registration details": "PAN ABCDE1234F", "Products or services offered": "Uniforms and safety gear.", "Geographic service coverage": "Uttar Pradesh" } },
  "/enquiry": { form: "enquiry", submit: "Submit Enquiry", text: { Name: "Test Client", "Mobile number": "9876543210", "Email address": "client@example.com", "Nature of enquiry": "Manpower supply", "City and state": "Kanpur, UP", Message: "We need 20 workers for a project." }, company: ["Company of interest", "Shivanji HR Solutions Private Limited"] },
  "/contact": { form: "contact", submit: "Send an Enquiry", text: { Name: "Test Visitor", Phone: "9876543210", Email: "visitor@example.com", Enquiry: "General", Message: "Please call me back about your services." } },
};
for (const [path, f] of Object.entries(FILLS)) {
  test(`${path} form checks its fields, then sends`, async ({ page }) => {
    await page.goto(path);
    const form = page.locator("form.hp-form");
    await form.getByRole("button", { name: f.submit }).click();
    await expect(form.getByText("This field is required.").first()).toBeVisible();
    await expect(form.getByRole("alert")).toContainText("Please correct");

    let sent;
    await page.route("**/api/site-form", async (route) => { sent = route.request().postDataBuffer().toString(); await route.fulfill({ json: { ok: true } }); });
    for (const [label, value] of Object.entries(f.text)) await form.getByLabel(new RegExp(`^${label}`)).fill(value);
    if (f.file) await form.getByLabel(new RegExp(`^${f.file[0]}`)).setInputFiles({ name: f.file[1], mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    if (f.company) await form.getByLabel(new RegExp(`^${f.company[0]}`)).selectOption(f.company[1]);
    if (f.consent) await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: f.submit }).click();
    await expect(form.getByRole("status")).toHaveText("Thank you. Your details have been submitted successfully.");
    expect(sent).toContain(`name="form"\r\n\r\n${f.form}`);
    await expect(form.getByText("This field is required.")).toHaveCount(0);
  });
}

test("Shivanji HR Solutions is listed and has its own page (website only)", async ({ page }) => {
  await page.goto("/companies");
  await page.getByRole("link", { name: /Shivanji HR Solutions Private Limited/ }).first().click();
  await expect(page).toHaveURL(/\/companies\/shivanji-hr-solutions$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shivanji HR Solutions Private Limited");
  await page.getByRole("link", { name: "Discuss Your HR & Staffing Needs" }).first().click();
  await expect(page.getByLabel(/^Company of interest/)).toHaveValue("Shivanji HR Solutions Private Limited");
});
