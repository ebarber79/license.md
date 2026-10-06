// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Serves the static site and runs the E2E suite against it.
 * Tests drive the game through the gated window.NeonDashTest API (?test=1).
 */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8000",
    trace: "on-first-retry",
    // Opt-in: run against a system browser (e.g. PW_CHROMIUM=/usr/bin/chromium on the
    // arm64 Pi, where Playwright's bundled browsers aren't kept). Unset in CI.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "python3 -m http.server 8000",
    url: "http://localhost:8000",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
