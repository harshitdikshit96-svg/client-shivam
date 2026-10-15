// End-to-end tests in a real browser against the built app.   npm run test:e2e
// First time on a new machine: npx playwright install chromium
import { defineConfig, devices } from "@playwright/test";

const port = 3210;
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Desktop Chrome"],
    // cloud sandbox ships its own Chromium; elsewhere Playwright's bundled browser is used
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
