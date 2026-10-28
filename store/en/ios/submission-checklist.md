# App Store Connect: what to enter (launch version, no ads, iPhone and iPad)

Text fields come from the files next to this one. Do not paste anything from outside `store/en/`.

## App information
| Field | Value |
|---|---|
| Name | `ios/title.txt` |
| Subtitle | `ios/subtitle.txt` |
| Bundle ID | com.dicedengame.app |
| SKU | dice-den-ios-1 (any unique string) |
| Primary category | Games, subcategory Board (secondary: Games, Family) |
| Content rights | Does not contain third-party content |
| Price | Your choice (Pricing and Availability); no in-app purchases in this version |

## Version 1.0.0
| Field | Value |
|---|---|
| Promotional text | `ios/promotional-text.txt` |
| Description | `ios/description.txt` |
| Keywords | `ios/keywords.txt` |
| Support URL | Your support page (see `docs/index.html`; needs a public address) |
| Marketing URL | Optional |
| Privacy Policy URL | Your privacy page (see `docs/privacy.html`; needs a public address) |
| Copyright | 2026 and the name on the developer account |
| App Review notes | `ios/review-notes.txt` |
| Sign-in required | No |
| Version release | Manual release after approval is safest for a first launch |

## Screenshots (from the simulator build)
| Device class | Size | Needed |
|---|---|---|
| iPhone 6.9" (iPhone 16/17 Pro Max) | 1320 x 2868 | Yes, 3 to 10 |
| iPad 13" (iPad Pro M4/M5) | 2064 x 2752 | Yes, because the app supports iPad |
| Captions | `screenshot-captions.txt` | Optional overlay text; keep to the store-word rules |

## App Privacy
Data Not Collected. No tracking. See `privacy.md`.

## Age rating questionnaire
Answer None to every item (no violence, no mature themes, no gambling, no contests, no user-generated
content, no web access, no unrestricted links). The game uses no real money or prizes, so it is not
simulated gambling. Expected rating: 4+.

## Export compliance
The app uses only the operating system's standard encryption and no custom cryptography (the random
number generator is not encryption). You can set `ITSAppUsesNonExemptEncryption` to false in the iOS
config so the question is not asked on every upload. You decide this declaration; check it against your
own reading of the rules.

## Capabilities and signing
- iCloud key-value storage entitlement (`com.apple.developer.ubiquity-kvstore-identifier`): EAS creates the
  capability on the App ID when you build with your Apple account.
- Push notifications: not needed (daily reminders are local notifications).

## Before pressing Submit
1. EAS `production` iOS build made with your Apple Developer account, then `eas submit`.
2. TestFlight smoke test on a real iPhone: install, play a full game, kill and resume, Settings, Stats, Today's dice.
3. No `EXPO_PUBLIC_MONETIZATION` and no Sentry DSN in the build environment.
