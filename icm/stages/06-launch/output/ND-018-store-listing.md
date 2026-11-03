# ND-018 — Play store listing (ready to paste)

Copy, category, links and asset map: `docs/STORE_LISTING.md` (canonical; don't duplicate).
Assets: `docs/store/` — icon 512, feature graphic 1024×500, 5 captioned phone screenshots
1080×1920 (+ raw frames). Regenerate: `scripts/capture-store-shots.js`.

Screenshots show the build on `mobile-capacitor` after ND-019/020/021/023 (no QR, scrolling
start screen, power-up shoes, Boost). Upload them only with an AAB that has those changes
(versionCode 4, `NeonDash-release-v4.aab`, which also has the music), so the listing matches the app.

Human steps (Play Console, after the app exists — ND-003):
1. Main store listing: paste name, short + full description; upload icon, feature graphic,
   5 phone screenshots.
2. Store settings: category Game → Arcade; tags; contact email; website.
3. App content: privacy policy URL; data safety from `ND-015-data-safety.md`; target
   audience 13+ (ND-016); ads = yes; content rating questionnaire.
