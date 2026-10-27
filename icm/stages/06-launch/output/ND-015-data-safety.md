# ND-015: Play Console answers (data safety, privacy, audience)

Draft by Claude, 2026-10-27, from the code on branch `nd-014`. The human fills these in on Play Console.
Before submitting, check against Google's own AdMob guidance, which is the authority on the SDK:
https://developers.google.com/admob/android/privacy/play-data-disclosure

## Privacy policy URL
https://ebarber79.github.io/license.md/privacy.html (live once `privacy.html` reaches `master`).

## Data safety

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all user data collected by your app encrypted in transit? | Yes (AdMob, RevenueCat and Google Play all use HTTPS) |
| Do you provide a way for users to request that their data is deleted? | Yes: email neondash@gridlas.com (stated in the policy) |

Data types (collected = the SDKs send it off the device):

| Category > type | Collected | Shared | Optional? | Purposes | Source |
|---|---|---|---|---|---|
| Location > Approximate location (from IP) | Yes | Yes | No | Advertising or marketing; Analytics; Fraud prevention, security and compliance | AdMob |
| Device or other IDs (advertising ID, app set ID) | Yes | Yes | No | Advertising or marketing; Analytics; Fraud prevention, security and compliance | AdMob (RevenueCat's anonymous ID too) |
| App activity > App interactions (ad interactions) | Yes | Yes | No | Advertising or marketing; Analytics | AdMob |
| App info and performance > Diagnostics | Yes | No | No | Analytics; App functionality | AdMob SDK |
| Financial info > Purchase history | Yes | No | Yes (only buyers) | App functionality | Google Play Billing via RevenueCat |

Not collected: name, email, contacts, photos, precise location, messages, health, files, web history, user-generated content.
Game progress stays on the device (localStorage), so it isn't "collected".

## App content (other forms)

| Form | Answer |
|---|---|
| Ads | Yes, the app contains ads |
| Target audience | **13–15, 16–17, 18+** only (no under-13 groups); not designed for children (ND-016) |
| Advertising ID declaration | Yes, used for advertising and analytics (the AdMob SDK adds `com.google.android.gms.permission.AD_ID`) |
| Content rating (IARC) | Category: Game. No violence beyond bumping into obstacles, no user-to-user interaction or chat, no location sharing. **In-app purchases: Yes** (gem packs). Ads: Yes. |
| Government app / Financial features / Health | No |
| News app | No |

## AdMob (human)
- Privacy & messaging → GDPR → Create message → app Neon Dash → Publish (ND-014).
- Optional: US state regulations message (same screen) for CCPA-style regions.
