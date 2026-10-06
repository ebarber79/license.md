# Neon Dash — launch checklist

Seeded 2026-10-06. Tick with a date when confirmed. Tracker IDs in brackets.

## Phase 0 — protect what exists

- [ ] Keystore password backed up off the VPS (password manager) [ND-002]
- [x] Keystore file copied off the VPS: `~/Desktop/neondash-release.jks` (2026-07-20)
- [x] Gem-shop WIP committed + pushed [ND-001] (2026-10-06)

## Phase 1 — get on Play (internal test)

- [ ] Play Console developer account ($25 one-time) [ND-003]
- [ ] Create app, package `io.github.ebarber79.neondash` [ND-003]
- [x] Signed release AAB built (versionCode 1): `~/Desktop/NeonDash-release.aab` (2026-07-20)
- [ ] Upload AAB to the internal-test track, add yourself as tester [ND-004]
- [ ] Install from the Play test link, confirm it launches

## Phase 2 — money

- [x] AdMob account + real ad units wired, `IS_TESTING=false` (2026-07-20)
- [ ] AdMob payments: W-9/tax info + bank account [ND-006]
- [ ] Declare a developer website in the Play listing, then publish `app-ads.txt` there [ND-007]
- [ ] Create 4 consumables in Play: `neondash.gems.500` / `.1200` / `.3000` / `.7000` [ND-005]
- [ ] RevenueCat account, link Play app, import products, copy the `goog_` key [ND-005]
- [ ] Hand the key to Claude, which wires it, rebuilds (versionCode 2), and you upload it [ND-005]
- [ ] Test purchase with a license-tester account (no real charge)

## Phase 3 — public release (later)

- [ ] Store listing: icon, screenshots, short/long description, content rating, data-safety form
- [ ] Closed testing (Play requires testers for 14 days on new personal accounts before production)
- [ ] Production rollout
