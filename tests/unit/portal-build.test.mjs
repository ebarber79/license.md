// Portal builds must contain no outgoing links (CrazyGames/GameDistribution rules).
// Only the portal's own SDK script origin may appear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALLOWED = {
  crazygames: [/^https:\/\/sdk\.crazygames\.com\//],
  gamedistribution: [/^https:\/\/html5\.api\.gamedistribution\.com\//],
};

for (const portal of Object.keys(ALLOWED)) {
  test(`${portal} build has no outgoing links`, () => {
    execSync(`node scripts/build-portal.mjs ${portal}`, { cwd: ROOT, stdio: "ignore" });
    const dir = join(ROOT, "dist", portal);
    const bad = [];
    for (const f of readdirSync(dir)) {
      if (!/\.(html|js)$/.test(f) || f.startsWith("ad-provider.")) continue;
      const src = readFileSync(join(dir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")          // block comments
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1")      // line comments
        .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, ""); // CSP lists allowed origins, not links
      for (const m of src.matchAll(/mailto:[^\s"'<>)]*/g)) bad.push(`${f}: ${m[0]}`);
      for (const m of src.matchAll(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi)) bad.push(`${f}: email ${m[0]}`);
      for (const m of src.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
        if (/^http:\/\/www\.w3\.org\//.test(m[0])) continue; // SVG/XML namespaces
        if (!ALLOWED[portal].some((r) => r.test(m[0]))) bad.push(`${f}: ${m[0]}`);
      }
    }
    assert.deepEqual(bad, [], "outgoing links found:\n" + bad.join("\n"));
    const html = readFileSync(join(dir, "index.html"), "utf8");
    assert.ok(!html.includes('id="rate-link"'), "rate link present");
    assert.ok(!html.includes('id="share-btn"'), "share button present");
    assert.ok(!html.includes('id="feedback-link"'), "feedback link present");
    assert.ok(!html.includes("qr-cap") && !html.includes('id="qr'), "QR block not fully removed");
    // structure must match the canonical page: same <div> balance as the source
    const src = readFileSync(join(ROOT, "index.html"), "utf8");
    const bal = (s) => (s.match(/<div\b/g) || []).length - (s.match(/<\/div>/g) || []).length;
    assert.equal(bal(html), bal(src), "unbalanced <div> tags in portal index.html");
  });
}

// Every local <script src> in a portal index.html must ship in the bundle
// (music.js was missing from the first CrazyGames upload).
for (const portal of Object.keys(ALLOWED)) {
  test(`${portal} build ships every local script it loads`, () => {
    execSync(`node scripts/build-portal.mjs ${portal}`, { cwd: ROOT, stdio: "ignore" });
    const dir = join(ROOT, "dist", portal);
    const html = readFileSync(join(dir, "index.html"), "utf8");
    const files = new Set(readdirSync(dir));
    const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])
      .filter((s) => !/^https?:/.test(s) && !files.has(s));
    assert.deepEqual(missing, []);
  });
}
