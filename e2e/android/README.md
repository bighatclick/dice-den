# Android emulator suite

Maestro flows written for Android (Back button, force-stop, airplane mode, deep links,
system permissions, landscape, large text, dark mode, tablet) against the build that goes
to the stores. Ads and purchases are switched off in that build (`src/config/features.ts`),
and the suite checks that nothing monetized shows. The table of cases, with device state
and timings, is in `docs/android-test-suite.md`.

Run through the runner, which installs the APK, runs the static security and release checks,
sets the device up per group, and collects reports and screenshots under `reports/android/`:

```powershell
powershell -File scripts\android-e2e.ps1
```

Suites: `release` (default), `visual` (landscape, large text, dark mode), `tablet`, `long`
(the 4-game and 10-game flows), `checks` (static checks only), `all`.

`monetized/` holds the flows for the shop, ads and consent. They are parked: they run only
with `-Suite monetized` against an APK built with `scripts\build-android-test-apk.ps1
-Monetization`, for the day the switch is turned back on.

To run one flow by hand:

```powershell
maestro test e2e\android\A04-android-back.yaml
```
