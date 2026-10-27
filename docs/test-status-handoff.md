# Test status handoff (27 Oct 2026)

Branch `claude/application-test-cases-68a937`. Dashboard: https://claude.ai/artifact/4Bn9vBGei2AEoK8Vvzh717

## iOS (GitHub Actions, EAS simulator build)
- All 8 flows passed on the final build: https://expo.dev/artifacts/eas/5yP1D3GO187_6BwQSUZIRMCG9V6jXMcsFGhTaEjiE-8.tar.gz
  (7 in one full run, vs-computer on its own rerun after its flow fix; no single clean 8-of-8 run yet).
- Launch crash cause: native Sentry start with an empty DSN. Fixed in `app.config.js`.
- Forced-order label now toggles the switch (`app/new-game.tsx`).
- Run: `gh workflow run ci.yml --ref <branch> -f ios=true -f app_url=<build url>`; optional `-f flows='e2e/x.yaml'`, `-f diag_only=true`.
- GitHub minutes used this month: about 1,250 of 2,000 (macOS bills 10x). Roughly 4 full iOS runs left.

## Android (emulator, runner `scripts/android-e2e.ps1 -Suite release`)
APK rebuilt from this branch (Sentry config changed), release group results:
- Passed: A01-A05, A08-A17, S1-S6, S8.
- Failed: S7 (cold start 8.3 s vs 8 s, first run after install, rerun needed), A06 and A07.
- A18-A21 (other suite groups) not rerun on the new build.
- A06/A07: the computer's turn finished before Maestro's check (race). My manual reruns had the emulator
  animation scale at 0, which the app reads as Reduce Motion, so those reruns were invalid. Rerun with the
  runner's own settings (window_animation_scale 0 only) or the full runner. A07 line 66 now waits for the
  handoff overlay to clear (uncommitted-then-committed edit in this commit).
- Rule: a fixed case stays yellow until a rerun passes.

## Next steps
1. Rerun A06, A07, S7 via the runner (restart emulator first), then groups visual/tablet/long for A18-A21.
2. Update the dashboard (datasets/cases asset) with the results.
3. One clean full iOS run (8 flows) for the record.
4. Optional: more iOS cases (settings, stats, dark mode, iPad), store screenshots from the simulator build,
   TestFlight smoke test of the production build, Apple Developer account ($99).

## Update (last check)
A06 and A07 rerun with the runner's normal animation settings (animator and transition scale 1, window scale 0) still FAIL:
A06 at `Computer (Easy) is playing` is visible, A07 at a `Pass the phone to` is not visible check. Both are about the
computer's turn, and both passed on the 22 Oct APK, so treat this as a possible real regression until proven a race:
compare the computer-turn timing (`app/game.tsx` AI_DELAY, Reduce Motion detection) between the 22 Oct APK behaviour
and this build, then look at the failure screenshots in `C:\Users\Dell\.maestro\tests\`. Not fixed, not green.
