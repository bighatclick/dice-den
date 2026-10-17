# Testing Dice Den on the Android emulator

This is the first time the app runs outside Jest. The goal is to find out early
whether the native parts work: storage, sound, haptics, notifications, sharing,
ads and the shop. Everything here works without App Store, Play Console or AdMob
accounts.

## What this PC already has

| Item | Status |
|---|---|
| Android Studio, SDK platforms 34–36, build-tools 36, NDK 27 | Installed |
| JDK 17 (Microsoft build) | Installed, `JAVA_HOME` set |
| Emulator images | API 34 and API 35 "Google APIs" x86_64 |
| Virtual devices | `SalesTrackerApi35`, `SalesTrackerTablet`, `SalesTrackerTest` (from another project) |
| `ANDROID_HOME`, `adb` on PATH | **Missing** (step 1) |
| Maestro | **Missing** (step 5, optional) |

The PC has an i3 with 4 threads and 20 GB RAM. The first build took about an hour
here; later builds are a few minutes. Close Chrome and other heavy apps while
building.

Windows' 260-character path limit (`LongPathsEnabled` is 0 on this PC) broke the
first C++ build with `ninja: error: mkdir(...): No such file or directory`. The
config plugin `plugins/withShortCxxPath.js` now builds the app's C++ code in
`E:\dd-cxx` instead, so no Windows setting needs to change. If a build ever fails
with that error again, delete `android/app/.cxx` and `E:\dd-cxx` and rebuild.

"Google APIs" images include Google Play services, so test ads work. They have no
Play Store app, so real Play Billing purchases can't run on them; the fake store
covers the shop instead.

## 1. One-time setup (PowerShell)

Set `ANDROID_HOME` and put `adb` and `emulator` on PATH for your user, then open a
new terminal:

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

```powershell
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ";$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", 'User')
```

Then, in Android Studio › Device Manager, create two devices:

- **DiceDenPhone**: Pixel 8, API 35 Google APIs x86_64 image, 2 GB RAM.
- **DiceDenTablet**: Pixel Tablet, the same image (for the iPad-style layout).

The SalesTracker devices would work too, but separate devices keep the two
projects' data apart.

## 2. Build and run

Start the phone emulator first (Device Manager › ▶, or `emulator -avd DiceDenPhone`).

**Build A: fake store** (use this for most testing). Purchases succeed after a
short pause, nothing is charged, and Google's test ads show:

```powershell
$env:EXPO_PUBLIC_FAKE_STORE = "1"; npx expo run:android
```

**Build B: the normal build.** No store account exists yet, so the shop should say
the store isn't available and everything else should keep working:

```powershell
Remove-Item Env:EXPO_PUBLIC_FAKE_STORE; npx expo run:android
```

**EEA consent form.** To see Google's consent form, as players in Europe and
the UK will:

```powershell
$env:EXPO_PUBLIC_FAKE_STORE = "1"; $env:EXPO_PUBLIC_UMP_DEBUG_EEA = "1"; npx expo run:android
```

The `EXPO_PUBLIC_*` switches are read when Metro bundles the app. After changing
them, stop Metro and start it again with `npx expo start --clear`. They only
affect development builds. Don't set `CI=1` for Metro: it turns off file
watching, so code changes never reach the app.

To start from a clean install (first launch, session 1), run this, then reopen the app:

```powershell
adb shell pm clear com.dicedengame.app
```

To start a new **session**, swipe the app away in Recents and reopen it.

## 3. Checklist

Tick each item and note anything odd: a screenshot plus one line is enough.

### Core game (Build A)
- [ ] First launch shows the tutorial; Skip works; no permission prompt appears.
- [ ] Solo game: roll, hold (die lifts, shows a lock and HELD), score, Undo, all 13 turns, final scorecard.
- [ ] vs Computer (Easy, Normal, Expert): the computer plays by itself; tap to skip works.
- [ ] Pass and play, 3 players: the handoff screen hides the dice between people.
- [ ] **Android Back on the table** asks "Leave game?"; Stay keeps you there; Leave goes Home and Resume brings the exact same dice back.
- [ ] **Android Back on the final scorecard** goes Home.
- [ ] Kill the app mid-turn (swipe it away in Recents), reopen it: same dice, holds and rolls left.
- [ ] Today's dice: play, the result locks, the streak shows 1, there is no Play again, Share opens the share sheet with the image.
- [ ] Stats fill in after a few games.

### Look and feel
- [ ] Sound plays on roll, hold and score; turning off Settings › Sound effects silences it.
- [ ] Haptics: the emulator has none. Check this on a real phone later.
- [ ] Dark mode, using Settings › Theme and the system quick setting: every screen is readable.
- [ ] Largest font size (Android Settings › Display › Font size): nothing is cut off; the score pad stays usable.
- [ ] Rotate to landscape: the table and pad sit side by side.
- [ ] Tablet emulator: the layout uses the space, and every player's column is visible.
- [ ] Reduce motion (in-app): dice fade instead of tumbling.

### Reminder
- [ ] Turning on Settings › Daily reminder triggers Android 13's notification permission prompt.
- [ ] Allow it, set the earliest time, and move the emulator clock past it: the reminder arrives.
- [ ] Deny it: the setting explains how to turn notifications on.

### Ads (Build A, Google test ads, labelled "Test Ad")
- [ ] Session 1: finish 3 games. **No ad** appears anywhere.
- [ ] Start session 2 (swipe away and reopen), then finish game 4 and wait more than 3 s on the scorecard. Tap Home: a muted **Test Ad** interstitial appears. After you close it, you land on Home.
- [ ] Finish game 5, then tap Home: **no ad**, because ads are at most 1 per 2 games.
- [ ] Finish game 6 within 4 minutes of that ad: **no ad**, because ads are at most 1 per 4 minutes.
- [ ] Ads never appear during a game, on the handoff screen, on Home after launch, or after Today's dice.
- [ ] Final scorecard from game 3 on: the small "Enjoying Dice Den?" card appears **once**.
- [ ] Airplane mode: everything still works, and leaving the scorecard is never held up.
- [ ] EEA build: the consent form appears on Home after the tutorial. Settings › Purchases shows "Ad privacy choices", which reopens the form.

### Shop (Build A, fake store)
- [ ] Prices show on each product; every one says "One-time purchase".
- [ ] Buy the Classic Dice Pack: "Thank you! It's yours.", and its skins can be used. The dice on the table change.
- [ ] Buy the Table Pack and pick Night: the game table changes colour.
- [ ] "Try for 24 h" on a locked skin shows a **test rewarded ad**. Close it after the reward: the skin is in use and marked Trial. After 3 ads the shop says there are no more ads to watch today.
- [ ] Buy Remove Ads, then repeat the ads checks: **no interstitial ever**, but "Try for 24 h" still works.
- [ ] Restore Purchases, in the Shop and in Settings, shows a message. The fake store forgets purchases when the app restarts, so Restore then finds nothing, but the items stay owned from the app's own saved record.
- [ ] Today's dice after finishing: "Replay today's dice" plays a test rewarded ad and starts a replay. The locked score doesn't change.
- [ ] Skins earned by play: after 10 games, the final scorecard says "New dice unlocked: Amber".

### Build B (normal build, no store account)
- [ ] The Shop says the store isn't available. Buttons show "Not available", and the dice and table picker still works.
- [ ] Nothing hangs: leaving the shop and playing are instant.

### First run results (17 Oct 2026, DiceDenPhone, API 35)

Driven by Claude over adb. Passed:

- Tutorial and the rules picker, with no permission prompt.
- Solo games, roll, hold (lock and HELD), scoring and the final scorecard.
- Back on the table asks "Leave game?". After a force-stop, Resume brings back the exact dice.
- Ads:
  - none until the rules allow one;
  - a muted test interstitial after leaving the scorecard, then Home;
  - none on the next game (1 per 2 games);
  - the "Enjoying Dice Den?" card shows once, at game 3.
- Shop (fake store):
  - prices and "One-time purchase" on every item;
  - buying the Classic Dice Pack;
  - Casino red dice on the table;
  - a Night table trial through a test rewarded ad;
  - Remove Ads, after which no interstitial appeared even where the rules allowed one;
  - Restore in Settings.
- Dark theme.
- The notification prompt, plus the explanation when it is denied.
- Today's dice: the result locks with no Play again, the streak shows 1, and Share opens the sheet with the image. Replay through a rewarded ad starts a new table.
- Build B: the Shop says the store isn't available, and owned items stay owned.

Fixed during the run:

- The status bar text was dark on the green felt (tutorial and table).
- Switches that were off were nearly invisible in dark mode.

Not covered yet:

- vs Computer and pass and play;
- landscape and the tablet;
- largest font size;
- reduce motion;
- an allowed reminder arriving;
- airplane mode;
- the EEA consent form;
- 10-game and 7-day unlocks.

## 4. If something goes wrong

- Red error screen: take a screenshot of it.
- Silent problem: capture the log while reproducing it, then send `dice-den.log`:

```powershell
adb logcat -d *:E ReactNativeJS:V > dice-den.log
```

- Build fails: copy the last 40 lines of the build output.

## 5. Optional: run the Maestro flows

Maestro runs the flows in `e2e/` by tapping through the app. It needs Java 17
(installed). Install it from https://maestro.dev, then run this with the
emulator open and Build A installed:

```powershell
maestro test e2e/
```

The flows were written against iOS labels, so expect a few small text fixes on
the first Android run. Send the failures and they'll be fixed in the flows.

## 6. What the emulator can't cover

| Needs | What |
|---|---|
| A real Android phone | Haptics, real sound, performance (60 fps dice, cold start) |
| Play Console ($25) and an internal test track | Real Play Billing purchases and restore |
| AdMob account | Real ads and earnings; blocked categories set in the console |
| A Mac, an Apple developer account and an iPhone | iOS build, StoreKit, ATT prompt, iCloud sync |
