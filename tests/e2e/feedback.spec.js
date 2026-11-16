// @ts-check
// ND-036: "Send feedback" link on the start screen opens an email with the version filled in.
const { test, expect } = require("@playwright/test");

test.describe("ND-036 feedback link", () => {
  test("start screen shows a mailto link with subject and version", async ({ page }) => {
    await page.goto("/index.html?test=1");
    const link = page.locator("#feedback-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveText("Send feedback");
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:neondash@gridlas\.com\?subject=/);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("subject")).toBe("Neon Dash feedback (web)");
    expect(q.get("body")).toContain("Neon Dash web (web)");
  });

  test("clicking it does not start a run", async ({ page }) => {
    await page.goto("/index.html?test=1");
    await page.waitForFunction(() => !!window.NeonDashTest);
    // Stop the browser from leaving the page for the mail app.
    await page.evaluate(() => document.getElementById("feedback-link")
      .addEventListener("click", (e) => e.preventDefault()));
    await page.click("#feedback-link");
    await expect(page.locator("#start-screen")).toBeVisible();
    const started = await page.evaluate(() =>
      window.NeonAnalytics._buffer.some((e) => e.event === "game_start"));
    expect(started).toBe(false);
  });
});
