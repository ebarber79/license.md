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
      for (const m of src.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
        if (/^http:\/\/www\.w3\.org\//.test(m[0])) continue; // SVG/XML namespaces
        if (!ALLOWED[portal].some((r) => r.test(m[0]))) bad.push(`${f}: ${m[0]}`);
      }
    }
    assert.deepEqual(bad, [], "outgoing links found:\n" + bad.join("\n"));
    const html = readFileSync(join(dir, "index.html"), "utf8");
    assert.ok(!html.includes('id="rate-link"'), "rate link present");
    assert.ok(!html.includes('id="share-btn"'), "share button present");
  });
}
