// @ts-check
// Service worker: works offline, and caches every script the page loads.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("every local script in index.html is in the offline cache list", () => {
  const root = path.join(__dirname, "..", "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^":]+)"/g)].map((m) => m[1]);
  const missing = scripts.filter((s) => !sw.includes(`"./${s}"`));
  // Native-only scripts (app build) are allowed to be absent from the web cache.
  const nativeOnly = ["ad-provider.js", "admob-provider.js", "iap-provider.js", "iap.js"];
  expect(missing.filter((s) => !nativeOnly.includes(s))).toEqual([]);
});

test("game loads offline after the first visit", async ({ page, context }) => {
  await page.goto("/index.html");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await expect(page.locator("#start-screen")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#start-btn")).toBeVisible();
  expect(await page.evaluate(() => typeof window.NeonMusic)).toBe("object");
  await context.setOffline(false);
});
