#!/usr/bin/env node
// Assembles the Capacitor web asset dir (www/) from the static game source.
// Capacitor copies whatever is in webDir into the native app, so we keep it to
// exactly the runtime files the game loads — no node_modules, docs, tests, or
// native project folders. Regenerate any time with `npm run build:www`.
import { mkdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

// Everything index.html references, plus what game.js/sw.js pull in at runtime.
const ASSETS = [
  'index.html',
  'style.css',
  'manifest.json',
  'icon.svg',
  'sw.js',
  'register-sw.js',
  'analytics.js',
  'ad-provider.js',
  'ads.js',
  'progress.js',
  'engine.js',
  'game.js',
  'qrcode.js',
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of ASSETS) {
  await copyFile(join(root, f), join(out, f));
}
console.log(`build:www — copied ${ASSETS.length} files into www/`);
