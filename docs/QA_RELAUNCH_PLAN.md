# Neon Dash — Relaunch QA & Remediation Plan

**App:** Neon Dash (HTML5 Canvas endless runner, PWA)
**Architecture:** Static client-side PWA — no backend, no accounts, no server data sync. Persistence is `localStorage`; offline via service worker; hosted on GitHub Pages.
**Document owner:** {qa_lead} · **Version:** 0.1 (draft) · **Date:** {date}
**Status:** DRAFT — pending inputs (see §11) to finalize estimates, numeric gates, and the 4-week calendar.

> **Architecture note / honest scope reconciliation.** The original brief assumes a native iOS/Android app with server auth, data sync, and battery APIs. Neon Dash is a **single-page static PWA**. Domains that don't apply are explicitly marked **N/A** with rationale and reframed to their web equivalents:
> - *Authentication* → **N/A** (no accounts). Reframed to **identity/persistence** via `localStorage`.
> - *Data sync* → **N/A** (no server). Reframed to **local persistence durability**.
> - *Battery usage APIs* → limited on web. Reframed to **render-loop efficiency / Page Visibility**.
> - *Native crash reporting* → must be **added** (web error logging); none exists today.

---

## 1. Executive Summary

Neon Dash is a feature-complete, single-screen endless-runner PWA that is **live but unverified**: core gameplay, a gem shop with persisted skins, three power-ups, PWA install/offline, and a scan-to-play QR are all implemented, but the build has **had zero formal test passes, no automated suite, and no analytics/error instrumentation**. The main risk areas are (a) **no observability** — we are blind to crashes and real-device frame rate; (b) **accessibility/photosensitivity** — heavy flashing/shake/pulse animations with no `prefers-reduced-motion` guard; and (c) **persistence edge cases** — at least one unguarded `localStorage` write that can throw in private mode. **Target: ≥95% verified functionality** (defined numerically in §5) before relaunch, gated on P0 = 0 open, instrumentation live, and key-flow smoke tests green.

---

## 2. Known Defects Already Identified (code review)

These are concrete issues found by inspecting the current source — they seed the remediation plan (not hypothetical).

| ID | Severity | Area | Finding | Fix summary |
|----|----------|------|---------|-------------|
| BUG-01 | **P1** | A11y | No `prefers-reduced-motion` handling; title pulse, screen shake, flashing power-up auras, theme strobe run unconditionally — photosensitivity/UX risk. | Gate non-essential motion behind the media query; provide reduced variants. |
| BUG-02 | **P2** | Persistence | Mute toggle calls `localStorage.setItem("neondash.muted", …)` **without** try/catch (unlike `saveBest`/`persistProgress`). Throws in Safari private mode / storage-disabled. | Wrap in try/catch (reuse a `safeSet` helper). |
| BUG-03 | **P2** | Audio | `audio.ensure()` is skipped when the gesture targets a `.btn`/`.icon-btn`, so tapping **PLAY** does not unlock WebAudio; sound is silent until the first in-canvas tap. | Unlock audio on PLAY/RESUME clicks too. |
| BUG-04 | **P2** | Lifecycle | No `visibilitychange` auto-pause; backgrounding mid-run relies on rAF throttling and dt-clamp. Functionally safe but no explicit pause and a wasted partial frame on return. | Auto-pause on `document.hidden`. |
| BUG-05 | **P2** | Observability | No error logging, crash reporting, or analytics anywhere. We cannot measure crash-free rate or funnels. | Add error sink + analytics events (§7). |
| BUG-06 | **P2** | Security | No Content-Security-Policy. Low exploit surface (no untrusted HTML injection found), but headers are missing. | Add CSP (note: GitHub Pages can't set headers — see §6 mitigation). |
| BUG-07 | **P3** | UX | Stale-cache update story: cache-first SW serves old `index.html` until the SW activates on a later load; users may see the previous version once after a deploy. | Document; consider update toast / `skipWaiting` UX. |

---

## 3. Prioritized Remediation Plan

Effort = forward planning estimate in engineer-days (S≤0.5, M≈1–2, L≈3–5). Owners are role placeholders.

### 3.1 IMMEDIATE HOTFIXES — `CRITICAL` (block basic use / verification)
> Target: complete before Sprint 1 testing begins.

| # | Item | Why critical | Owner | Effort |
|---|------|--------------|-------|--------|
| H1 | Add **error/crash logging** (`window.onerror`, `onunhandledrejection`) → sink | Without it we cannot prove the crash-free gate | {fe_eng} | M |
| H2 | Add **core analytics events** (`game_start`, `game_over`, `error`) | Required to measure §5 gates and §6 rollout | {fe_eng} | M |
| H3 | Fix **BUG-02** unguarded storage write | Uncaught exception path in common config (private mode) | {fe_eng} | S |
| H4 | Establish **deterministic test seed hook** (inject RNG + state getters for tests) | Prerequisite for automating P0 gameplay cases | {fe_eng} | M |

### 3.2 SHORT-TERM — Sprint 1
| # | Item | Owner | Effort |
|---|------|-------|--------|
| S1 | **BUG-01** reduced-motion support (P1 a11y) | {fe_eng} | M |
| S2 | **BUG-03** unlock audio on PLAY/RESUME | {fe_eng} | S |
| S3 | **BUG-04** visibilitychange auto-pause | {fe_eng} | S |
| S4 | Stand up **Playwright** suite for all P0 cases (NAV, CORE collisions/jumps, persistence) | {qa_eng} | L |
| S5 | **Unit tests** for physics/collision/scoring/power-up math | {qa_eng} | M |
| S6 | **Lighthouse CI** (PWA, perf, a11y, best-practices) wired into CI | {devops} | M |
| S7 | Remaining analytics events (`powerup_collected`, `skin_*`, `pwa_installed`) | {fe_eng} | M |

### 3.3 MEDIUM-TERM — Sprints 2–3
| # | Item | Owner | Effort |
|---|------|-------|--------|
| M1 | **BUG-06** CSP via `<meta http-equiv>` (Pages) or move to host with header control | {fe_eng}/{devops} | M |
| M2 | Real-device perf RUM (frame timing beacon) + dashboard | {fe_eng} | M |
| M3 | A11y depth: canvas `aria-label`, contrast fixes, SR-usable menus (NDA11Y-02/03/05) | {fe_eng} | M |
| M4 | SW update UX (BUG-07): "new version available" reload toast | {fe_eng} | M |
| M5 | Cross-device matrix soak (memory NDPERF-02, long-run stability) | {qa_eng} | M |
| M6 | Visual regression snapshots (theme shifts, skins) | {qa_eng} | M |

---

## 4. QA Verification Matrix

Full 10-column matrix (Test Case ID, Description, Preconditions, Steps, Expected, Priority, Acceptance, Automation candidate, Tool) is maintained as the **exportable CSV: `docs/qa_verification_matrix.csv`** (52 cases across all domains). Summary view below; **P0 rows are CRITICAL gates.**

| ID | Domain | Description | Pri | "Verified" acceptance | Auto? |
|----|--------|-------------|-----|------------------------|-------|
| ND-ON-01 | Onboarding | First load shows start screen | **P0** | Visible <2s, PLAY tappable, no console errors | Yes |
| ND-ON-02 | Onboarding | PWA installable | P1 | Installs; launches standalone fullscreen | Partial |
| ND-ON-03 | Onboarding | Offline first paint after install | P1 | Loads + playable offline | Yes |
| ND-AUTH-01 | Auth | **N/A — no accounts** | P3 | Confirmed no auth paths; documented | No |
| ND-NAV-01 | Navigation | Start → Play | **P0** | state=playing, loop runs, first frame <500ms | Yes |
| ND-NAV-02 | Navigation | Pause → Resume | P1 | No dt spike; positions continuous | Yes |
| ND-NAV-03 | Navigation | Pause → Quit | P1 | Bank +gems exactly once | Yes |
| ND-NAV-04 | Navigation | Game over → Play Again | **P0** | score=0, obstacles cleared, loop runs | Yes |
| ND-NAV-05 | Navigation | Game over → Menu & Skins | P1 | Bank shown == post-run total | Yes |
| ND-CORE-01 | Core | Single jump | **P0** | vy set, gravity arc, lands | Yes |
| ND-CORE-02 | Core | Double jump cap | **P0** | jumps capped at 2 | Yes |
| ND-CORE-03 | Core | Spike collision → game over | **P0** | state=over, crash fx | Yes |
| ND-CORE-04 | Core | Bar collision → game over | **P0** | state=over on overlap | Yes |
| ND-CORE-05 | Core | Gem collection | P1 | coins+1, gem removed | Yes |
| ND-CORE-06 | Core | Shield absorbs one hit | P1 | shieldTime→0, survive, one hit only | Yes |
| ND-CORE-07 | Core | Magnet attracts gems | P2 | Gems in range move to player | Yes |
| ND-CORE-08 | Core | Slow-mo scales world speed | P2 | worldSpeed=speed×factor | Yes |
| ND-CORE-09 | Core | Difficulty ramp fair | P1 | speed↑ to cap, no impossible gaps | Yes |
| ND-CORE-10 | Core | Score = distance/10 | P1 | matches formula | Yes |
| ND-CORE-11 | Core | Theme shifts | P3 | palette interpolates, no flicker | Partial |
| ND-DATA-01 | Persistence | High score persists | P1 | neondash.best retained | Yes |
| ND-DATA-02 | Persistence | Gem bank persists | P1 | neondash.bank retained | Yes |
| ND-DATA-03 | Persistence | Skin own/select persists | P1 | neondash.skins/skin correct | Yes |
| ND-DATA-04 | Persistence | Mute persists | P2 | neondash.muted retained | Yes |
| ND-DATA-05 | Persistence | Storage-unavailable graceful | P1 | No uncaught throw; defaults used | Yes |
| ND-OFF-01 | Offline | SW registers | P1 | controller present | Yes |
| ND-OFF-02 | Offline | Full offline play | P1 | all assets cached; no failed fetch | Yes |
| ND-OFF-03 | Offline | Cache update on new version | P2 | old caches purged, new active | Partial |
| ND-UI-01 | UI/UX | Responsive portrait | P1 | no overflow; controls reachable | Partial |
| ND-UI-02 | UI/UX | Safe-area insets | P2 | no notch overlap | No |
| ND-UI-03 | UI/UX | HiDPI crispness | P2 | dpr-scaled backing store | No |
| ND-UI-04 | UI/UX | Resize/orientation | P2 | dims recompute, no distortion | Partial |
| ND-UI-05 | UI/UX | Tap targets ≥44px | P2 | all buttons meet min | Yes |
| ND-UI-06 | UI/UX | QR renders & scans | P2 | decoded == location.href | Partial |
| ND-PERF-01 | Performance | Sustained 60fps | P1 | p95 frame ≤ {frame_budget_ms} | Partial |
| ND-PERF-02 | Performance | No memory growth | P1 | heap stable over soak | Partial |
| ND-PERF-03 | Performance | Tab-switch dt clamp | P1 | dt≤0.05, no teleport | Yes |
| ND-PERF-04 | Performance | Load size/time | P2 | TTI ≤ {tti_target}; payload ≤ {kb_target} | Yes |
| ND-BAT-01 | Battery/Net | Loop idle when hidden | P2 | no render while hidden | Yes |
| ND-NET-01 | Battery/Net | No unexpected network | P2 | zero 3rd-party requests pre-consent | Yes |
| ND-SEC-01 | Security | HTTPS enforced | P1 | http→https; HSTS if available | Yes |
| ND-SEC-02 | Security | No injection (persist/QR) | P1 | guarded parse; no untrusted innerHTML | Yes |
| ND-SEC-03 | Security | CSP present | P2 | CSP enforced | Yes |
| ND-SEC-04 | Security | SW scope safe | P2 | scope limited | No |
| ND-A11Y-01 | Accessibility | Reduced motion respected | **P1** | motion gated by media query | Yes |
| ND-A11Y-02 | Accessibility | Controls have names | P2 | all buttons labeled | Yes |
| ND-A11Y-03 | Accessibility | Text contrast | P2 | ≥4.5:1 body text | Yes |
| ND-A11Y-04 | Accessibility | Keyboard play | P2 | Space/Arrow/W jump; no scroll | Yes |
| ND-A11Y-05 | Accessibility | Non-visual alternative | P3 | canvas aria-label; menus SR-usable | Partial |
| ND-AN-01 | Analytics | game_start fires | P1 | event + session/run id | Yes |
| ND-AN-02 | Analytics | game_over w/ score+gems | P1 | payload accurate | Yes |
| ND-AN-03 | Analytics | powerup_collected | P2 | type ∈ {shield,magnet,slowmo} | Yes |
| ND-AN-04 | Analytics | skin_purchased/selected | P2 | id+cost correct, no double-fire | Yes |
| ND-AN-05 | Analytics | error/crash logging fires | **P0** | onerror/onunhandledrejection → sink | Yes |

---

## 5. Release Gating Criteria — "95% Functionality Verified" `CRITICAL`

Relaunch is **blocked** unless ALL of the following hold. "95%" is defined by the verified-case ratio plus hard gates:

1. **Verified case ratio ≥ 95%** = (cases meeting acceptance criteria) ÷ (total applicable cases, excluding N/A). With 51 applicable cases, ≥ **49 verified**.
2. **P0 open defects = 0** and **all P0 test cases = PASS** (no waivers). `CRITICAL`
3. **P1 verified ≥ 95%**; any unverified P1 requires written waiver from {product_owner}.
4. **Automated suite pass rate = 100%** on the P0/P1 automation subset in CI.
5. **Manual coverage ≥ 90%** of P2/P3 cases executed at least once on the device matrix.
6. **Crash-free sessions ≥ {crash_free_target}** over the canary window. *Derivation:* set baseline = first 72h of canary error-sink data; target = max(99.0%, baseline). No prior data exists, so this MUST be measured post-instrumentation — do not assume.
7. **Key-flow smoke test = PASS** (the 5 flows in §6.4) on every supported config.
8. **Performance:** p95 frame time ≤ {frame_budget_ms} (derive from 60fps target = 16.7ms; set p95 budget e.g. ≤ 20ms once measured) and Lighthouse Perf ≥ {lh_perf_target}, PWA ≥ {lh_pwa_target}, A11y ≥ {lh_a11y_target}.

---

## 6. Rollout Strategy

### 6.1 Phased release
Because Pages serves one branch globally (no native store staging), implement phasing in-app:
1. **Canary (internal):** deploy to a separate path/branch (e.g. `/canary/`) or preview URL; QA + stakeholders only. Duration: 48–72h.
2. **Percentage rollout:** gate the new build behind a client flag bucketed by a hashed client id stored in `localStorage` (e.g. 10% → 50% → 100%), reading a small remote `flags.json`. Old build remains the fallback.
3. **Full rollout:** flip flag to 100% after gates hold through each step.

> If a true store presence is later added (TWA/Capacitor wrapper), use Play **staged rollout** + iOS **phased release** natively.

### 6.2 Monitoring plan
Watch dashboards (see §7) during each step: crash-free rate, JS error volume/rate, frame-time p95, asset load failures, SW activation errors, funnel completion (start→game_over).

### 6.3 Immediate rollback criteria `CRITICAL`
Roll back (flip flag to previous build) if ANY within a rollout step:
- Crash-free rate drops below {crash_free_target} or error rate spikes > {error_rate_ceiling}× baseline.
- Any new **P0** reproduced in production.
- `game_start`→`game_over` funnel completion drops > {funnel_drop_pct} vs prior build.
- SW activation/asset-fetch failure rate > {sw_fail_ceiling}.
Rollback = set flag to last-good build (instant for flag-gated clients) and, if needed, `git revert` + redeploy.

### 6.4 Post-release verification — first 72 hours
- [ ] 5 **key-flow smoke tests** pass on prod: (1) load→PLAY→jump→crash→game over, (2) double-jump, (3) collect gem & power-up, (4) buy+equip skin & reload persists, (5) install PWA → offline play.
- [ ] Crash-free rate ≥ target at 24h / 48h / 72h checkpoints.
- [ ] No P0/P1 in triage queue.
- [ ] Frame-time p95 within budget on RUM.
- [ ] Analytics events flowing with expected volumes; no schema errors.
- [ ] SW updated cleanly (no stale-version reports).

---

## 7. Instrumentation & Observability (add/validate before relaunch)

**Error/crash logging (NEW — H1):** hook `window.onerror` + `window.onunhandledrejection` → lightweight sink (e.g., Sentry browser SDK, or a custom beacon). Capture: message, stack, build version, state, userAgent, viewport.

**Analytics events (NEW — H2/S7):**
| Event | Key properties |
|-------|----------------|
| `game_start` | run_id, skin, build |
| `game_over` | run_id, score, gems, duration, cause |
| `powerup_collected` | type (shield/magnet/slowmo) |
| `skin_purchased` / `skin_selected` | skin_id, cost, bank_after |
| `pwa_installed` | source |
| `qr_view` | (start screen shown) |
| `error` | message, stack, build |

**Performance tracing (M2):** beacon `requestAnimationFrame` p50/p95 frame time, long-task count, TTI; Lighthouse CI in pipeline.

**Dashboards & alerts (threshold examples — finalize after baseline):**
- Crash-free rate < {crash_free_target} → page on-call. 
- JS error rate > {error_rate_ceiling}× 1h baseline → alert.
- Frame p95 > {frame_budget_ms} sustained 10 min → alert.
- Asset/SW fetch failure > {sw_fail_ceiling} → alert.
- Funnel (start→over) completion < {funnel_floor} → alert.

> All numeric thresholds are placeholders until the first 72h of canary data establishes a baseline; derive each as described in §5.6.

---

## 8. Bug Triage & Severity Process

**Severity definitions:**
- **P0 / Critical:** blocks basic use or data loss, crash on a key flow, security issue. SLA: fix or rollback **same day**.
- **P1 / High:** major feature broken, no reasonable workaround, a11y blocker. SLA: **≤ 2 business days**.
- **P2 / Medium:** minor feature / edge case / cosmetic-with-impact. SLA: **within current sprint**.
- **P3 / Low:** cosmetic / nice-to-have. SLA: **backlog / opportunistic**.

**Triage cadence:** daily 15-min standup triage during verification sprints (all new bugs triaged within 24h); a 45-min weekly review for backlog grooming and SLA audit.

**Required bug report fields:** ID, title, severity (proposed), build/commit SHA, platform/browser/OS, device, repro steps, expected vs actual, frequency (always/intermittent/once), screenshot/recording, console/error-sink link, related test case ID, owner.

**Flow:** New → Triaged (sev + owner) → In Progress → Fixed (PR linked) → **Verified** (QA re-runs the linked test case) → Closed. A bug is **not closed** until its test case passes.

---

## 9. Risk Register (Top 8)

| # | Risk | Likelihood | Impact | Mitigation | Contingency |
|---|------|-----------|--------|------------|-------------|
| R1 | No baseline crash/perf data → gates unmeasurable | High | High | Ship instrumentation (H1/H2) **first**; bake 72h canary | Delay relaunch until baseline exists |
| R2 | Photosensitivity from flashing/shake (BUG-01) | Med | High (safety/legal) | Implement reduced-motion (S1); default-safe | Hotfix-disable heavy effects via flag |
| R3 | Persistence throws in private mode (BUG-02) | Med | Med | Guard all writes (H3) | Feature-detect + in-memory fallback |
| R4 | Stale SW serves old build after deploy (BUG-07) | High | Low/Med | Update toast (M4); cache versioning | Document; force-reload guidance |
| R5 | Real-device frame rate below target on low-end | Med | Med | RUM (M2); perf budget gate | Reduce particle counts / effects tier |
| R6 | GitHub Pages can't set security headers (CSP/HSTS) | High | Low/Med | `<meta>` CSP (M1) | Move to Netlify/Cloudflare Pages for headers |
| R7 | Single-branch deploy = no native staging | High | Med | In-app flag-based % rollout (§6) | Separate canary path/preview URL |
| R8 | Audio silent until first canvas tap (BUG-03) | Med | Low | Unlock on PLAY/RESUME (S2) | Document as known minor |

---

## 10. Four-Week Test Schedule (target relaunch: **{relaunch_date}**)

| Week | Window | Milestones |
|------|--------|-----------|
| **Wk 1** | Days 1–2 | Hotfixes H1–H4 (instrumentation, storage guard, test seed hook) merged |
| | Days 3–5 | Sprint 1 fixes S1–S3; Playwright P0 suite (S4) + unit tests (S5) scaffolded; Lighthouse CI (S6) green |
| **Wk 2** | Days 6–8 | Complete S4/S5 (all P0 automated PASS); analytics events (S7) verified in QA |
| | Days 9–10 | Manual device-matrix pass of P1/P2 (UI, offline, persistence, a11y); triage burn-down |
| **Wk 3** | Days 11–13 | Medium-term M1–M3 (CSP, RUM dashboard, a11y depth); visual regression (M6) |
| | Days 14–15 | **Gate review #1**: verify ≥95% ratio, P0=0; soak test (M5) memory/long-run |
| **Wk 4** | Days 16–18 | **Canary deploy** (internal) + 48–72h baseline collection; tune alert thresholds |
| | Days 19–20 | % rollout 10%→50%; monitor gates; **Gate review #2 (go/no-go)** |
| | Day 21 | **100% rollout / relaunch** → begin 72h post-release checklist (§6.4) |

---

## 11. Inputs Requested (to finalize this plan)

Adapted to this app's real (web/PWA) architecture — several brief items are reframed:

1. **Build/URL:** production = `https://ebarber79.github.io/license.md/` (confirmed live). Provide any **canary/preview** URL preference, and whether a native wrapper (TWA/Capacitor) is in scope.
2. **Current test reports / CI:** none exist today — confirm we are greenfield, and your preferred **CI** (GitHub Actions assumed) and **test frameworks** (Playwright + a unit runner like Vitest/Jest proposed).
3. **Crash/analytics:** none today — confirm chosen **analytics + error sink** (e.g., Sentry, Plausible/GA4, or custom beacon) and any privacy/consent constraints.
4. **Target matrix:** list **browsers + OS versions + device tiers** to support (e.g., iOS Safari {versions}, Chrome Android {versions}, low/mid/high device tiers). Drives §4 device cases and perf budgets.
5. **Relaunch window:** provide **{relaunch_date}** and any hard deadline so I can lock the §10 calendar and rebalance effort.
6. **Threshold derivation:** approve the §5/§7 placeholder approach (baseline from first 72h canary), or supply existing targets if you have them.

---

*Exportable artifacts: this document (`docs/QA_RELAUNCH_PLAN.md`) and the full QA matrix (`docs/qa_verification_matrix.csv`).*
