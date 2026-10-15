import { defineConfig } from "@playwright/test";
const port = Number(process.env.DINNER_TEST_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("DINNER_TEST_PORT must be an integer from 1024 to 65535.");
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: origin,
    headless: true,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: ["--no-sandbox"],
        }
      : {},
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 0.0.0.0 --directory dist`,
    url: origin,
    reuseExistingServer: !process.env.CI,
  },
});
