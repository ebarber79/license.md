#!/usr/bin/env bash
# Package the static game into dist/neon-dash.zip for a portal upload.
# Usage: bash scripts/build-dist.sh
#
# This bundles the CORE files only. For a portal build, first add that portal's
# ad-provider + SDK <script> tags and CSP changes (see integrations/<portal>/),
# and consider removing register-sw.js + the #qr-box (see those READMEs).
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="dist"
ZIP="$OUT/neon-dash.zip"

CORE=(
  index.html style.css
  game.js engine.js ads.js analytics.js progress.js qrcode.js register-sw.js
  manifest.json sw.js icon.svg
)

rm -rf "$OUT"
mkdir -p "$OUT/neon-dash"
for f in "${CORE[@]}"; do
  cp "$f" "$OUT/neon-dash/$f"
done

( cd "$OUT/neon-dash" && zip -qr "../neon-dash.zip" . )
echo "Built $ZIP"
unzip -l "$ZIP" | tail -n +2
