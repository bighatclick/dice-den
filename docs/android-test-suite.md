# Android emulator test suite

Maestro flows in `e2e/android/`, driven by `scripts/android-e2e.ps1`, run on the
DiceDenPhone (Pixel 8, API 35) and DiceDenTablet emulators against the APK that
`scripts/build-android-test-apk.ps1` produces.

**What the app ships with now:** ads and purchases are switched off
(`src/config/features.ts`, off unless a build sets `EXPO_PUBLIC_MONETIZATION=1`). The
default suites test that build and check that nothing monetized shows anywhere. The
shop, ad and consent flows are parked in `e2e/android/monetized/` for the day the switch
is turned back on; they never run by default.

## Running

```powershell
powershell -File scripts\build-android-test-apk.ps1              # the APK
powershell -File scripts\android-e2e.ps1                          # release suite
powershell -File scripts\android-e2e.ps1 -Suite checks            # static checks only
powershell -File scripts\android-e2e.ps1 -Suite visual            # landscape, large text, dark mode
powershell -File scripts\android-e2e.ps1 -Suite tablet -Avd DiceDenTablet
powershell -File scripts\android-e2e.ps1 -Suite long              # the 4-game and 10-game flows
```

The runner boots the emulator if needed, installs the APK, hides the emulator's
"isn't responding" dialogs, turns animations off, runs the static checks, sets the
device state each group needs, runs the flows for that group's tags, restores the
device, and writes JUnit XML, logs and screenshots to `reports\android\<timestamp>-<suite>\`.

Maestro 2.11.0 is installed under `%USERPROFILE%\.maestro` (the release zip from
github.com/mobile-dev-inc/Maestro, checksum verified). Java 17 is already installed.

## Static checks (every run, about 20 s)

These cover the release-prep items from the security audit. On the APK built before the
audit fixes, S2, S5 and S6 fail, which is the audit's finding; they pass once the fixes
are in and a new APK is built.

| ID | Check | Expected | Result on the 22 Oct APK (main 58ee9c6, upload key) |
|---|---|---|---|
| S1 | Requested permissions | No camera, contacts, location, mic, storage, phone, SMS, calendar or Bluetooth permission (CLAUDE.md rule 7) | pass |
| S2 | Ad and billing permissions | With the switch off: no `AD_ID`, `ACCESS_ADSERVICES_*` or `com.android.vending.BILLING` | pass (none requested) |
| S3 | `targetSdkVersion` | 35 or higher (Play requirement) | pass (36) |
| S4 | Debuggable | Not set | pass |
| S5 | AdMob app id | No Google test id `ca-app-pub-3940256099942544` in the manifest | informational while the SDK ships: present, no ad is ever requested with the switch off |
| S6 | Signing | Not the Android debug key | pass (`CN=Dice Den`) |
| S7 | Cold start | `am start -W` under 8 s on the emulator (proxy for 2 s on a phone, specs.md) | pass (3.2 s) |
| S8 | APK size | Under 80 MB (specs.md R21) | pass (68.6 MB) |

## Release suite (tags `release`)

Measured times are from the run on 22 Oct; the others are estimates from the same
emulator (a 13-turn game is about 75 s of taps).

| ID | Flow | Scenario | Expected | Time |
|---|---|---|---|---|
| A01 | `A01-first-launch` | Clean install: tutorial, practice turn, rules picker | No permission prompt; second roll locked until all 5s held; Scandinavian saved in Settings; no Shop icon on Home; no Purchases group or Ad privacy choices anywhere in Settings; no ad or restore questions in Help; "Your data" note | 1 min 51 s (measured, passed) |
| A02 | `A02-solo-full-game` | Solo Classic, 13 turns | Bonus progress label, "Turn 13", scorecard with Upper/Bonus/Lower/Yatzys chips, nothing covering it, Home shows "Best N · 1 games", no Resume | 2 min 14 s (measured, passed) |
| A03 | `A03-holds-rolls-undo` | Hold, release, three rolls, undo | Held dice survive rerolls; after roll 3 the button says Pick a box and dice are disabled; undo once, gone after the next roll | 1 min 22 s (measured, passed) |
| A04 | `A04-android-back` | Back on every screen | Settings/Stats/New game: Home. Table: "Leave game?"; Stay keeps state; Leave then Resume brings the same dice and holds. Scorecard: Home. Home: exits the app | 3 min 33 s (measured, passed; the Home exit is checked by hand) |
| A05 | `A05-kill-and-resume` | Force-stop mid-turn, mid-computer-turn, with settings changed | Exact dice, holds and roll count return; the computer finishes its turn; Dark and Large dice persist | 2 min 19 s (measured, passed) |
| A06 | `A06-vs-computer-levels` | Easy, Normal, Expert; autoplay, skip, read-only card, replace dialog | Each level finishes its turn alone or on Skip; no undo of its score; "Start a new game?" with Cancel; Fast speed finishes within 12 s | 2 min 13 s (measured, passed) |
| A07 | `A07-pass-and-play-six` | Six seats, names, add/remove, a computer seat, handoff, undo from handoff | 2 to 6 seats enforced; handoff names next and previous person, hides the Roll button, shows standings; undo from the handoff; no handoff after a computer; Back on handoff asks | 3 min 41 s (measured, passed) |
| A08 | `A08-scandinavian-forced-order` | Scandinavian + forced order, 15 turns, Play again | One tappable box per turn, pairs on the pad, bonus +50, "Turn 15", Play again keeps the rules, Settings remembers them | 2 min 43 s (measured, passed) |
| A09 | `A09-daily-dice` | Today's dice: resume, lock, streak, share, stats | Resume from Daily and Home; locked score, 1-day streak, Best 1, Share result, "New dice tomorrow", no replay offered; Stats counts 1 daily game | 3 min 11 s (measured, passed) |
| A10 | `A10-daily-replaces-saved-game` | Start today's dice over a saved game | "Play today's dice?" with Cancel keeping the game; confirming starts the daily; the normal game is gone | 1 min 30 s (measured, passed) |
| A11 | `A11-settings` | Every switch and picker, persistence, fairness page, tutorial replay | Hints off removes numbers but boxes still score; left-hand/large/high-contrast/reduce-motion table plays; theme switches; all values survive a force-stop; fairness text; Stats link | 3 min 23 s (measured, passed) |
| A12 | `A12-reminder-permission` | Daily reminder on Android 13+ | Toggling asks for notification permission; Allow enables it with a time picker; Deny shows the explanation and leaves it off | 2 min 31 s (measured, passed) |
| A13 | `A13-stats-and-share` | Empty stats, stats after a game, rules filter, dice chart, Share sheet | Games 1, high score, average, bonus rate, "65 rolls" for you and "0 rolls" for the computer; Scandinavian filter shows 0; Share opens the Android sheet (screenshot) and Back returns | 4 min 32 s (measured, passed) |
| A14 | `A14-deep-links` | `diceden://daily`, `stats`, `game` | Each opens its screen; the table link starts a solo game that then shows as Resume | 42 s (measured, passed) |
| A15 | `A15-offline` | Airplane mode | A whole game, scorecard, leaving, today's dice and the picker all work with no network; nothing to buy or watch is offered | 3 min 14 s (measured, passed) |
| A16 | `A16-no-monetization-in-release` | Four games in a second session (the only time an ad could ever have shown) | No test ad, no "Enjoying Dice Den?" card, no Shop, no Purchases, picker shows only free and earned styles, pack-only styles hidden | 9 min 59 s (measured, passed, `long`) |
| A17 | `A17-ten-games-unlock` | Ten finished games | Scorecard says "New dice unlocked: Amber", Use them opens Dice and tables, Amber equips | 21 min 35 s (measured, passed, `long`) |

## Visual suite (tags `visual`; the runner sets the device state)

| ID | Flow | Device state | Expected | Time |
|---|---|---|---|---|
| A18 | `A18-landscape-grid` | Rotated to landscape | Three-player table shows every column (cells read "Dad: Ones, empty"), no card tabs, only the current column tappable; screenshots of Home, table, Settings | 2 min 25 s (measured, passed) |
| A19 | `A19-large-text` | `font_scale` 2.0 | Home, New game, table, Settings, Stats, Daily render and a turn plays; screenshots for review | 1 min 27 s (measured, passed) |
| A20 | `A20-dark-mode-system` | System night mode, Theme = System | Every screen in the dark palette; screenshots of Home, New game, table, Settings, picker, Stats, Daily, Help | 1 min 44 s (measured, passed) |

## Tablet (tag `tablet`, `-Avd DiceDenTablet`)

| ID | Flow | Expected | Time |
|---|---|---|---|
| A21 | `A21-tablet` | Tutorial and Home keep a readable width; the score grid shows every player beside the dice; handoff and Settings lay out; screenshots | 58 s (measured, passed) |

## Parked: monetized flows (`e2e/android/monetized/`, only with `-Suite monetized`)

Not part of any default run. They need an APK from
`scripts\build-android-test-apk.ps1 -Monetization` (fake store, Google test ads) and
exist so the shop, ad rules and consent can be re-verified if the switch is turned back on.

| ID | Flow | Checks | Time |
|---|---|---|---|
| B01 | `B01-shop-products-and-picker` | Five products with prices and "One-time purchase"; buy both packs; equip Marble and Night; Complete Collection hidden once both packs are owned; Restore in Shop and Settings | 3 min |
| B02 | `B02-remove-ads` | After Remove Ads: "Ads removed", no interstitial or card after 4 games in session 2, rewarded trials still offered | 7 min |
| B03 | `B03-interstitial-cadence` | Never in session 1 or over a game or scorecard; card once at game 3; an ad only after leaving game 4; none after game 5 | 9 min |
| B04 | `B04-rewarded-trials-and-daily-replay` | Test rewarded ad grants a 24 h trial; counter drops; daily replay keeps the locked score | 4 min |
| B05 | `B05-eea-consent` | EEA build: consent form before any ad; Ad privacy choices reopens it | 1.5 min |
| B06 | `B06-store-unavailable` | No store account: shop says so within 2 s, Not available buttons, picker works, play is instant | 1.5 min |

## Totals

| Suite | Flows | Wall time |
|---|---|---|
| checks | S1 to S8 | 20 s |
| release | A01 to A15 | about 36 min (measured) |
| long | A16, A17 | about 32 min (measured) |
| visual | A18 to A20 | about 7 min |
| tablet | A21 | about 3 min with the tablet boot (measured: 58 s for the flow) |

## Not covered on the emulator

| Needs | What |
|---|---|
| A real phone | Haptics, speaker sound against media volume, 60 fps dice, real cold-start time |
| A week of real days | The 7-day streak unlock (Jade) and the streak freeze across weeks (both unit-tested) |
| TalkBack by hand | Spoken order and focus; the labels themselves are asserted by the flows |
| The Play Console | Upload-key signing is checked here (S6); the Play listing, Data safety form and the internal test track are manual |
