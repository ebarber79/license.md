# ND-037 spec: act on the Testers Community feedback report (v11)

Human go: 2026-11-15 ("go ahead with all five"). Scope: Android + web (game.js/index.html/style.css
are shared); native plugin calls guarded so web never loads native scripts (guardrail §4).

## Current
- No tutorial; start screen only has a one-line tagline. Analytics (Nov 10-15): avg run 2-9 s,
  every run ends on spikes.
- No Rate or Share. Only "Send feedback" (mailto) on the start screen.
- Android Back on the start screen calls `App.exitApp()` immediately (game.js handleBack/wireNativeBack).
- Store description (docs/STORE_LISTING.md) is decent but predates the gem shop / tutorial.

## Target
1. **First-run tutorial.** First run ever (localStorage `neondash_tutorial_done` unset), or any run
   started from the new "How to play" link, is a guided run:
   - `jump`: banner "Tap anywhere to jump". No obstacles until the first jump.
   - `spike`: one single spike spawns; when it's ~200 px from the player the world freezes with
     "Spike ahead! Tap to jump over it". The tap jumps and unfreezes.
   - `multi`: after clearing the spike: "Tap again in mid-air for a double, then a triple jump".
     Done when the player reaches 2 jumps in the air.
   - `gems`: a gem arc spawns: "Grab gems ◆ and spend them on skins and shoes". Done on first
     gem or after 4 s.
   - then "You're ready. Go!" toast, flag saved, normal spawning starts.
   - While guided: no crash (a hit clears the obstacle with a shake, banner "Jump a bit earlier"),
     no speed ramp, no power-up spawns. A **Skip** button ends it at once and saves the flag.
2. **Rate.** Start-screen link "Rate Neon Dash" (Android only) opens the Play Store page.
   After a finished run, on the 5th and 25th lifetime run, call the Play In-App Review API
   (`@capacitor-community/in-app-review`); Google decides whether to show it, it's dismissable.
3. **Share.** Start-screen link "Share" : Android uses `@capacitor/share` (Play URL);
   web uses `navigator.share` or copies the web URL and toasts "Link copied".
4. **Exit confirm.** Android Back on the start screen opens an in-app "Leave Neon Dash?" panel
   (Leave / Stay). Back again or Stay closes it; Leave exits. Escape on web does the same
   only when the panel is open.
5. **Store description.** Rewrite in docs/STORE_LISTING.md (human pastes into Play Console):
   keyword-natural, feature bullets incl. tutorial, clear audience line, only real features.

## Unchanged
Physics/tuning constants, scoring, gem economy, ads/IAP IDs, IS_TESTING, CSP, analytics schema
(only new event names added).

## Acceptance
A1 fresh storage + `?test=1`: `start()` → `getState().tutorial === "jump"`, obstacles 0 after 120 steps.
A2 `jump()` → step becomes `spike`; stepping freezes (score unchanged across 30 steps) while `tutorialHold`.
A3 a spike overlapping the player during the tutorial does not end the run.
A4 Skip → `tutorial === null`, `localStorage.neondash_tutorial_done === "1"`; next `start()` is normal.
A5 completing all steps saves the flag; the toast shows.
A6 "How to play" link starts a guided run even with the flag set.
A7 `back()` on the menu returns true and shows the exit panel; `back()` again hides it.
A8 Share/Rate links: Share visible on web; Rate hidden on web (no Capacitor).
A9 unit + e2e suites stay green; web build has no new native script tags.
Manual (phone, v11): tutorial plays on fresh install; Rate opens Play; Share sheet opens;
Back on menu shows the panel.

## Tests
New `tests/e2e/tutorial.spec.*` (A1-A8). Existing e2e that call `start()` on fresh storage get
the flag preset (test helper) so their runs stay unguided.

## Docs drift
QA_RELAUNCH_PLAN.md: add ND-037 cases. STORE_LISTING.md: new description. systems.md: new plugins.
