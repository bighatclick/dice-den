# CLAUDE.md: Dice Den (Yatzy)

Classic Yatzy dice game (solo, vs AI, pass-and-play 2–6, daily seeded dice). Expo + React Native + TypeScript. Offline, no backend, no login.
The full product spec is in `specs.md`; read the relevant section before changing behaviour. Research is in `../../research/yatzy_section9.md`.

## Commands
```bash
npm install
npx expo start                 # dev server (simulator: press i)
npx expo run:ios               # native build on the Mac (needed for MMKV, ads, IAP)
npm test                       # Jest unit + component tests
npm run typecheck              # tsc --noEmit
npm run lint
maestro test e2e/              # E2E flows on the iOS simulator
EXPO_PUBLIC_FAKE_STORE=1 npx expo run:android   # emulator build with the fake store (no store accounts)
eas build --local -p ios       # release build (no EAS cloud quota)
```
Push to GitHub at the end of every session: the rented Mac's disk can be wiped.

## Architecture
- `app/`: expo-router screens. Thin: they read stores and call engine functions.
- `src/engine/`: **pure TS game logic, no React or Expo imports**. `rng.ts`, `scoring.ts`, `rules/`, `game.ts` (reducer).
- `src/ai/`: AI strategies. Their input is only the current visible state (dice, holds, rolls left, card); they never get the RNG.
- `src/state/`: zustand stores, persisted through `src/data/`.
- `src/data/`: MMKV repository, `schema.ts` (`schemaVersion`), `migrations/` with fixtures.
- `src/ads/`, `src/iap/`: wrappers. All ad timing and frequency-cap logic lives in `src/ads/policy.ts` and is unit-tested.
- `src/ui/`: the **Den** design system (tokens, Dice, ScorePad). Only this app uses it; never copy it into another app.
- `modules/cloud-kv/`: local Expo module for iCloud key-value sync.

## Hard rules (never break)
1. **No ads during a game.** Interstitials only after leaving the final scorecard, never in session 1 or before 3 completed games, then at most 1 per 2 games and 1 per 4 minutes. Never on app open, on the handoff screen or in the daily dice. Ads muted.
2. **Fair dice.** One crypto RNG for every player and AI. No luck tied to difficulty, no rubber-banding, no "help" rolls. The daily uses seeded sfc32 from the date. Don't change RNG behaviour without updating the fairness page and the tests.
3. **Never lose progress.** Every schema change needs a new migration file plus a fixture test. Back up the raw blob before migrating; on failure keep the old data and never wipe. Autosave after every roll, hold and score.
4. **Trademarks:** never write "Yahtzee", "Kniffel" or "Yatzee" in code strings, UI, store text, IAP names or comments that ship. The box is "Yatzy".
5. **Store words:** no "free", "no ads", "ad-free", "#1", "best" or emoji in store text or screenshots (`store/en/`).
6. **No currency, no extra rolls, no energy, no subscriptions, no spin wheels.** Cosmetics only.
7. **Offline-first, privacy-light:** no backend, login or attribution SDKs, and no photo/contacts permissions. The ATT prompt comes only after the 3rd session, never mid-game. UMP consent comes before any ad request in EEA/UK.
8. **All UI text goes in `src/i18n/en.json`**; prices come from StoreKit, never hard-coded.
9. Ad or IAP failures must never block gameplay (2-second timeout, then continue).

## Conventions
- TypeScript strict; no `any` in engine code. Functional reducers; engine functions are pure and deterministic given an RNG.
- Tabular numerals for all scores. Touch targets ≥ 44 pt. Respect Reduce Motion and Dynamic Type.
- Name AI players "Computer (Easy/Normal/Expert)". Never present the AI as a human.
- Small commits with a message saying what changed and why.

## Testing expectations
- Scoring: 100% branch coverage, table-driven, both presets, joker and bonus edges (62/63).
- RNG: uniformity test (1M rolls, chi-square). Daily: the same date gives the same sequence on every run.
- Every new screen gets at least one component test; every bug fix gets a regression test.
- Before you call a task done, run `npm run typecheck && npm test` and the relevant Maestro flow.

## Definition of done (per feature)
The acceptance criteria in specs.md §6 pass · tests added and green · no TS or lint errors · works in light and dark mode, at large text size and in landscape on iPad · new strings in en.json · no hard rule broken.
