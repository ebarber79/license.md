#!/usr/bin/env node
/* Generate a portal-specific build from the canonical index.html.
 * Usage: node scripts/build-portal.mjs <crazygames|gamedistribution>
 *
 * Transforms (single source of truth = index.html):
 *  - remove the service-worker registration (portal iframe controls caching)
 *  - remove the scan-to-play QR block (portals disallow external links; this
 *    also means qrcode.js is never fetched, so it's dropped from the bundle)
 *  - swap the CSP for the portal's origins (or remove it for GameDistribution)
 *  - inject the portal SDK + ad-provider <script> tags
 * Output: dist/<portal>/ (+ dist/<portal>.zip)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const portal = process.argv[2];
const PORTALS = {
  crazygames: {
    csp: "default-src 'self'; script-src 'self' https://sdk.crazygames.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.crazygames.com; connect-src 'self' https://*.crazygames.com; font-src 'self'; manifest-src 'self'; frame-src https://*.crazygames.com https://*.crazygames.games; base-uri 'none'; object-src 'none'",
    scripts: [
      '  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
      '  <script src="ad-provider.crazygames.js"></script>',
    ],
    adapter: "integrations/crazygames/ad-provider.crazygames.js",
  },
  gamedistribution: {
    csp: null, // removed — GD serves programmatic ads from many partner origins
    scripts: [
      '  <script src="ad-provider.gamedistribution.js"></script>',
      '  <script src="https://html5.api.gamedistribution.com/main.min.js"></script>',
    ],
    adapter: "integrations/gamedistribution/ad-provider.gamedistribution.js",
  },
};
const cfg = PORTALS[portal];
if (!cfg) { console.error("Usage: node scripts/build-portal.mjs <crazygames|gamedistribution>"); process.exit(1); }

function replaceOnce(s, pattern, repl, label) {
  const next = s.replace(pattern, repl);
  if (next === s) throw new Error(`build-portal: anchor not found (${label}) — index.html changed; update this script.`);
  return next;
}

let html = readFileSync(join(ROOT, "index.html"), "utf8");
// 1. drop the service-worker registration
html = replaceOnce(html, /[ \t]*<script src="register-sw\.js"><\/script>\n/, "", "register-sw");
// 2. drop the QR block
html = replaceOnce(html, /[ \t]*<div id="qr-box">[\s\S]*?<\/div>\s*\n/, "", "qr-box");
// 3. CSP
html = replaceOnce(
  html,
  /[ \t]*<meta http-equiv="Content-Security-Policy"[^\n]*\n/,
  cfg.csp ? `  <meta http-equiv="Content-Security-Policy" content="${cfg.csp}" />\n` : "",
  "csp"
);
// 4. inject portal scripts before analytics.js
html = replaceOnce(html, /([ \t]*<script src="analytics\.js"><\/script>)/, cfg.scripts.join("\n") + "\n$1", "scripts");

// Assemble the bundle (core minus register-sw.js + qrcode.js, plus the adapter).
const CORE = ["style.css", "game.js", "engine.js", "ads.js", "analytics.js", "progress.js", "manifest.json", "sw.js", "icon.svg"];
const outDir = join(ROOT, "dist", portal);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html);
for (const f of CORE) copyFileSync(join(ROOT, f), join(outDir, f));
copyFileSync(join(ROOT, cfg.adapter), join(outDir, cfg.adapter.split("/").pop()));
// sw.js is shipped but harmless/unused without register-sw.js; drop it to be tidy.
rmSync(join(outDir, "sw.js"), { force: true });

execSync(`cd ${JSON.stringify(outDir)} && zip -qr ../${portal}.zip .`);
console.log(`Built dist/${portal}/ and dist/${portal}.zip`);
execSync(`unzip -l ${JSON.stringify(join(ROOT, "dist", portal + ".zip"))}`, { stdio: "inherit" });
