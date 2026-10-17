# Privacy answers (App Store privacy labels, Play Data safety)

Dice Den has no backend, no login and no analytics. Games, scores and settings
stay on the device (and in the player's own iCloud key-value store on iOS).

## Data collected by the Google Mobile Ads SDK (AdMob, with UMP)

| Data | Purpose | Linked to the player | Tracking |
|---|---|---|---|
| Device ID (IDFA / Android advertising ID) | Third-party advertising | No | Yes, only if allowed in the ATT prompt (iOS) or by consent (EEA/UK) |
| Product interaction (ad views and taps) | Third-party advertising, analytics | No | As above |
| Diagnostics (crash data, performance) | App functionality | No | No |
| Coarse location (from IP) | Third-party advertising | No | As above |

- Play Data safety: data is encrypted in transit; it cannot be deleted from inside
  the app because the app itself stores nothing about the player off the device.
- `com.google.android.gms.permission.AD_ID` is declared (added by the ads SDK).
- No photos, contacts, microphone or precise location are requested.

## Before release

- Replace the Google sample AdMob app ids in `app.json` with the real ones, and
  set the real ad unit ids as `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS`,
  `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS` and
  `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`. Release builds without them show no ads.
- In AdMob, block the gambling, dating, sexual, get-rich, alcohol and politics
  categories and set the maximum ad content rating to G (also set in code).
- Add the Sentry row (crash data) if Sentry is added.
