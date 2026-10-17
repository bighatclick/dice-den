# End-to-end flows (Maestro)

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

Still to add with the shop (build phase 5): the purchase flow against a
StoreKit test configuration, and "Remove Ads hides interstitials".
