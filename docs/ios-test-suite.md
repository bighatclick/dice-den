# iOS test suite

Maestro flows in `e2e/`, run on an iOS simulator against the simulator build that EAS makes
(`eas build --platform ios --profile simulator`). ads and purchases are off in this build
(`src/config/features.ts`), so the shop, remove-ads and interstitial flows are not in the default
run; they need a build made with `EXPO_PUBLIC_MONETIZATION=1` and the fake store.

## Running on GitHub Actions

Actions, then CI, then Run workflow, tick **ios**. Leave `build_id` empty to build a new simulator
app on EAS first (about 9 minutes on Expo's servers, no GitHub minutes), or paste the id of a
finished build to skip that. Needs the `EXPO_TOKEN` repository secret. The flows run on a macOS
runner, which costs 10 minutes of the private-repo allowance for each minute used.

Locally on a Mac: `maestro test e2e/onboarding.yaml e2e/full-game.yaml ...`.

## Cases

| ID | Flow | What it checks | Android time (measured) |
|---|---|---|---|
| I01 | `onboarding.yaml` | First run: practice turn (roll, hold the 5s, score) and the rules picker | 1 min 51 s |
| I02 | `full-game.yaml` | New game, 13 turns, final scorecard, nothing covering it, Home | 2 min 14 s |
| I03 | `holds-rolls-undo.yaml` | Holds survive rerolls, three rolls end the turn, undo works once | 1 min 22 s |
| I04 | `resume.yaml` | Kill mid-turn, relaunch: same dice, holds and roll count | 2 min 19 s |
| I05 | `vs-computer.yaml` | Computer takes its turn or is skipped, no undo of its score | 2 min 13 s |
| I06 | `pass-and-play.yaml` | Handoff screen names the next player and hides the dice | about 1 min 30 s |
| I07 | `scandinavian-forced-order.yaml` | 15 boxes, forced order, pairs, +50 bonus, Play again keeps the rules | about 2 min 30 s |
| I08 | `daily.yaml` | Today's dice: result locks, streak starts, no Play again | 3 min 11 s |

Parked until ads and purchases are switched on: `shop.yaml`, `remove-ads.yaml`, `interstitial.yaml`.

Not carried over from Android because iOS has no equivalent: the Back button, airplane mode
through the runner, notification permission, deep link intents. Landscape, large text and dark
mode checks for iOS are not written yet.

## Time to test (estimates; no iOS run has happened yet)

| Part | Estimate |
|---|---|
| EAS simulator build, only when no `build_id` is given | about 9 min (Expo's servers, free of GitHub minutes) |
| Runner setup: boot simulator, install Maestro, download the app | 5 to 7 min |
| Eight flows | 8 to 12 min (the Android sum is about 17 min on a slow emulator; a simulator is faster) |
| **One run on the macOS runner** | **about 15 to 20 min, billed as 150 to 200** |

The free private-repo allowance is about 2,000 minutes a month, so about one full run a month, or
two to three if the first runs fail early. Making the repo public removes the limit.

None of these flows has run on iOS. Expect the first run to find problems with the simulator
name, the app path or an assert that differs on iOS.
