# Data safety and age-rating answers (P2.7 draft)

Answers for today's build plus the planned SDKs. Re-check each when it ships; the owner submits them in the consoles.

## Google Play Data safety

| Question | Answer now | After AdMob / Firebase / RevenueCat |
|---|---|---|
| Collects or shares data? | No | Yes |
| Device or other ids (advertising id) | No | Collected and shared (AdMob), optional for the game's use |
| App activity (analytics events) | No (off until consent) | Collected, anonymous, optional |
| Purchase history | No | Collected (RevenueCat) |
| Personal info, location, photos, contacts | No | No (AdMob uses approximate location) |
| Encrypted in transit | n/a | Yes |
| Users can request deletion | n/a | Yes (reset in game, email) |
| Contains ads | No | **Yes** (rewarded, optional) |

## Content rating questionnaires (IARC / Apple)

Violence: none (cars are crushed, no people hurt). Sexual content, profanity, drugs, gambling: none. Simulated gambling:
**none** (no loot boxes; haggle slider and auction use earned tokens). User-generated content and chat: none.
Location sharing: none. Expected: **Everyone / 4+** (Apple may add "ads"). Unrestricted web access: no.
Made for children programme: **no** (rewarded ads); target age 13+.

## Apple App Privacy labels

Now: Data not collected. Later: Identifiers (device id for ads, not linked to identity), Usage data (analytics),
Purchases. Tracking: only if AdMob personalised ads are enabled, which needs the App Tracking Transparency prompt.
