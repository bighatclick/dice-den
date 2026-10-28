# Privacy answers (App Store privacy labels)

Dice Den has no backend, no login and no analytics. Games, scores and settings stay on the
device (and in the player's own iCloud key-value store on iOS, which the developer cannot read).

## Launch version (ads and purchases switched off)

App Store Connect, App Privacy:
- Data collection: **Data Not Collected**.
- Tracking: **No**. No App Tracking Transparency prompt, no advertising identifier.
- Third-party partners: none receive data.

Why this is accurate:
- The ad code is gated by `MONETIZATION_ENABLED` (`src/config/features.ts`). With it off the app uses the
  null ad provider and never calls `mobileAds().initialize()`, so the linked ad SDK does not start.
  `app.config.js` also removes the tracking-permission plugin in this build.
- Crash reporting (Sentry) starts only with `EXPO_PUBLIC_SENTRY_DSN` set at build time. The launch build is
  made without it, so nothing is sent.
- No photos, contacts, microphone or location permission is requested. The only permission is the
  optional daily-reminder notification.

Check before each submission: build without `EXPO_PUBLIC_MONETIZATION` and without a Sentry DSN.
If either is ever turned on, update the answers below first.

## If ads return later (not part of this launch)

Data collected by the Google Mobile Ads SDK (AdMob, with UMP):

| Data | Purpose | Linked to the player | Tracking |
|---|---|---|---|
| Device ID (IDFA) | Third-party advertising | No | Yes, only if allowed in the ATT prompt |
| Product interaction (ad views and taps) | Third-party advertising, analytics | No | As above |
| Diagnostics (crash data, performance) | App functionality | No | No |
| Coarse location (from IP) | Third-party advertising | No | As above |

- Replace the Google sample AdMob app ids in `app.json` with the real ones, and set the real ad unit ids as
  `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` and `EXPO_PUBLIC_ADMOB_REWARDED_IOS`.
- In AdMob, block the gambling, dating, sexual, get-rich, alcohol and politics categories and set the
  maximum ad content rating to G (also set in code).
- Add the Sentry row (crash data) if a Sentry DSN is added.
