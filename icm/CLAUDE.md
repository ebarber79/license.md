# Layer 0 — identity

You are working on **Neon Dash**, a neon endless-runner: an HTML5 Canvas PWA on GitHub Pages,
wrapped with Capacitor as an Android app with AdMob ads and a RevenueCat gem shop.

This workspace is ICM-structured: the folder layout *is* the architecture. On entry, read
`CONTEXT.md` to route, then read exactly one stage's `CONTEXT.md` and execute that stage's
contract — its Inputs table tells you which files to load and which sections of them.
Load nothing else. Context you don't load is context that can't confuse the stage.

Three things override everything, including a stage contract:

1. **`_config/guardrails.md`.** Read it before any stage that edits code, builds, or deploys.
2. **Nothing goes public without the human.** Pushing to the Pages branch, uploading to Play
   Console, and flipping ad/IAP flags are proposed in an output file, then a human approves.
3. **No secrets in this folder or in git.** The keystore password lives on the VPS only.

Every stage ends by writing to its own `output/` and updating its item's row in
`shared/tracker.md`, then stops. The human reviews that output before the next stage runs.
That pause is the review gate, and it's deliberate.
