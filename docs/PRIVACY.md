# Neon Dash — Privacy

_Last updated: 2026-06-20_

Neon Dash is a browser game. It has **no accounts, no login, and no server of its
own.** The game does not collect, store, or transmit any personal information.

## What the game stores

Your progress is saved **only on your own device** using the browser's
`localStorage`. That includes:

- best score and total gems,
- unlocked skins and the selected skin,
- daily streak, daily challenge, and mission progress,
- sound / haptics / reduced-motion preferences.

This data never leaves your browser. Clearing your browser data (or playing in a
private/incognito window) resets it. The game runs entirely client-side and works
offline.

## Analytics

The game ships with analytics **off by default**. No usage data is sent unless an
operator explicitly configures an analytics endpoint (`NEONDASH_ANALYTICS_URL`).
The public build on GitHub Pages does not set one, so nothing is transmitted.

## Ads and game portals

When Neon Dash is published on a third-party game portal (e.g. CrazyGames,
GameDistribution), that portal embeds the game and runs its **own** ad and
analytics systems. Those services are governed by **the portal's** privacy policy,
not this one — please refer to the host portal's policy for how they handle data.
Rewarded and interstitial ads only play in response to a direct tap (Continue /
Double Gems / Play Again).

## Children

The game collects no personal data and requires no sign-up, making it suitable for
general audiences. On a portal, the portal's own age-rating and ad policies apply.

## Contact

Questions about this game's data handling can be directed to the repository owner
via the project's GitHub page.
