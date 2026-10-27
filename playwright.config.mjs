// End-to-end tests in a real browser against the built app.   npm run test:e2e
// First time on a new machine: npx playwright install chromium
// The app runs on its own empty database (.data/e2e), so the tests never touch your local data.
import { defineConfig, devices } from "@playwright/test";

const port = 3210;
const db = "DATABASE_URL=pglite:./.data/e2e";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  workers: 1,             // the tests build on each other's data (firm → work order → workmen → wages)
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Desktop Chrome"],
    // cloud sandbox ships its own Chromium; elsewhere Playwright's bundled browser is used
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    // empty database + the single login the tests use
    command: `rm -rf .data/e2e && ${db} node scripts/db-migrate.mjs && ${db} ADMIN_USERNAME=e2e-owner ADMIN_PASSWORD=e2e-password-1 node scripts/db-login.mjs && NEXT_DIST_DIR=.next-e2e npm run build && NEXT_DIST_DIR=.next-e2e ALLOW_PGLITE=true ${db} npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240000,
  },
});
