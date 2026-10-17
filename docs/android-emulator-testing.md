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

### Second run results (17 Oct 2026, DiceDenPhone and DiceDenTablet, API 35)

Passed:

- vs Computer (Expert):
  - the computer plays by itself, and "Tap to skip" finishes its turn at once;
  - the final scorecard names the winner;
  - Android Back on the final scorecard goes Home.
- Starting a new game while one is saved asks "Start a new game?" first.
- Pass and play with 3 people:
  - names can be typed;
  - the handoff hides the dice between people, and Back there asks "Leave game?";
  - the next person starts on a fresh roll.
- Landscape: the table and pad sit side by side, and the pad scrolls to every box. Home, Settings and the Shop lay out well.
- 200% font size: the pad switches to one column and stays usable.
- Reduce motion (in-app): the dice fade in without the drop and spin. A screen recording shows both behaviours.
- With notifications allowed, the 7 PM reminder arrived ("Today's dice are ready"). It is an inexact alarm, so Android may deliver it late (up to about an hour).
- Airplane mode (switched on with the app already running):
  - a whole 3-person game plays to the end;
  - leaving the final scorecard goes Home;
  - the Shop says the store isn't available;
  - "Try for 24 h" dims for about 2 s, then says "No ad is available right now" under the button.
- EEA build (`EXPO_PUBLIC_UMP_DEBUG_EEA=1`):
  - Google's consent form (the "Publisher Test Ads" sample) appears on Home;
  - after "Do not consent", Settings › Purchases shows "Ad privacy choices", which reopens the form;
  - a muted rewarded test ad still plays and grants the trial.
- Finishing the 10th game shows "New dice unlocked: Amber" on the final scorecard, and Amber becomes usable in the Shop.
- Tablet (DiceDenTablet, Pixel Tablet, landscape): the tutorial, Home, Settings and a 3-person game all work. Every player's column now shows beside the dice (see below).

Fixed during the run:

- During the computer's turn the hint said "Roll to start your turn". It now says "Computer (Expert)'s turn".
- The screen reader called the player's own card "Show You's card". It now says "Show your card".
- When the computer won, the big number on the final scorecard was the player's own score with no label. It now says "Your score" whenever there was more than one player.
- With TalkBack, the handoff screen let people reach the table behind it, including the Roll button. The table is now hidden from screen readers until the next person starts.
- Dice not yet rolled this turn were meant to be dimmed, but the animation style overrode that (on iOS too). The last player's dice looked like a fresh roll; now they are dimmed.
- At 200% text:
  - the Resume button pushed its icon and "Turn 1 of 13" off the edges;
  - the calendar badge broke "OCT" over two lines;
  - names were cut short in the score chips and the handoff list;
  - the letters in the small avatar circles were clipped.
- Settings › Sound effects said "Muted by the silent switch" on Android, which has no such switch. It now says "Follows your media volume".
- The daily reminder showed a blank circle as its icon. It now uses the dice icon (`assets/notification-icon.png`, set in `app.json`).
- The player bar now scrolls to whoever is playing, so with 5–6 players or large text the current player is never off-screen.
- Tablets and landscape showed one player's card at a time behind tabs. specs.md S3 asks for every player's column there, so a new score grid (`src/ui/ScoreGrid.tsx`) now shows all columns side by side, with only the current player's column tappable. Phones in portrait keep the tabs.
- On the tablet every screen stretched edge to edge (2560 px wide buttons and cards). Screens now keep a readable width (`CONTENT_MAX_WIDTH`, 720 pt), and so does the tutorial.
- When no rewarded ad was available, the Shop put its note at the top of the page, far above the "Try for 24 h" button, so nothing seemed to happen. The note now appears under the button that was tapped, and the button dims while the ad loads.

Notes:

- Changing the system font size recreates the app's window. In development this logs "Looks like you have configured linking in multiple places". It is harmless: the game state is kept.
- `adb root` restarts adb and drops `adb reverse`. Run `adb reverse tcp:8081 tcp:8081` again afterwards.
- The debug build loads its code from the PC, so start it with the network on, then switch on airplane mode. A release build has the code inside it. Code changes made while offline only reach the app after the network is back and the app reloads.
- `npx expo prebuild` may delete and recreate `android/` after `app.json` changes. Stop Metro first, and keep logs and other files outside that folder. If Gradle then says "SDK location not found", recreate `android/local.properties` with the line `sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`.

Not covered yet:

- The 7-day unlock (Jade): it needs a week of daily dice.
- (Fixed later the same day.) The reminder used to fire on days whose dice were already done. It is now 7 one-off notifications for the coming days, rescheduled when today's dice are finished and whenever the app opens.
  - Checked on the tablet: with today not played, the 9 PM alarm was set for tonight. Finishing today's dice moved the first alarm to tomorrow, and no reminder came at 9 PM.
  - With the clock moved to the next evening, the reminder arrived with the dice icon.
  - Android may deliver these best-effort alarms up to an hour after the chosen time.

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
