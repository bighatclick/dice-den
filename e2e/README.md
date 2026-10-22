# End-to-end flows (Maestro)

The Android emulator suite (Back button, force-stop, airplane mode, permissions,
landscape, large text, dark mode, tablet, and the monetized test build) lives in
`e2e/android/` and runs through `scripts/android-e2e.ps1`; the case table is in
`docs/android-test-suite.md`. The flows below are the original iOS-first set.

Run on the iOS simulator with a development build (`npx expo run:ios`):

```bash
maestro test e2e/
```

| Flow | Checks |
|---|---|
| `full-game.yaml` | New game → 13 turns → final scorecard; nothing covers it |
| `resume.yaml` | Kill mid-turn, relaunch: same dice, holds and roll count (F2) |
| `vs-computer.yaml` | Computer turn plays and can be skipped |
| `pass-and-play.yaml` | Handoff screen between two people |
| `daily.yaml` | Today's dice: result locks, streak starts, no Play again |
| `onboarding.yaml` | First-run practice turn and rules picker |
| `shop.yaml` | Buy a pack, use one of its skins, Restore Purchases |
| `remove-ads.yaml` | With Remove Ads, no interstitial after 4 games in session 2 |
| `interstitial.yaml` | Without it: nothing covers a game or a scorecard; any ad comes after leaving |

`shop.yaml`, `remove-ads.yaml` and `interstitial.yaml` need a development build
made with the fake store, which works without App Store or Play accounts:

```bash
EXPO_PUBLIC_FAKE_STORE=1 npx expo run:android
```

They run the same way on the Android emulator (`maestro test e2e/shop.yaml`).
Once products exist in App Store Connect, run the purchase flow again against a
StoreKit test configuration in Xcode, with a normal build.
