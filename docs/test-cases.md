# Test cases: what the Jest suite covers

Run everything with `npm test`. Each line below is a scenario family; the file named holds the cases. The older suites (`scoring.test.ts`, `game.test.ts`, `policy.test.ts`, the screen tests…) still hold the originals; the files listed here go deeper into the same areas.

## Engine (pure TypeScript, `src/engine`)

| Area | File | Scenarios |
|---|---|---|
| Scoring, every roll | `scoring.exhaustive.test.ts` | All 7,776 ordered rolls scored in every box of both presets against an independent reference written from specs.md §4.2 · order independence · no negative or fractional scores · straight and of-a-kind relationships · known one-roll frequencies (300 full houses, 240 large straights, 1,200 small straights…) |
| Joker rule | `scoring.exhaustive.test.ts` | Every face: matching upper box forced while open, any lower box at full value once used, upper-for-zero fallback when the lower section is full · a Yatzy scored as 0 never arms the joker · no joker in Scandinavian · hints agree with allowed boxes |
| Forced order, totals | `scoring.exhaustive.test.ts` | Pad walked in exact order for both presets · 62/63 boundary · maximum Classic card · foreign boxes ignored · extra-Yatzy bonus scaling |
| Reducer | `game.scenarios.test.ts` | Reducer never mutates (deep-frozen input) · 6-player Classic game, Scandinavian forced order · game ends only when the last card is full · extra Yatzys per player, undo takes the count back · undo restores player/round/holds, cannot chain, survives a refused hold · rollAction maps faces onto free dice only · randomised fuzz (20 games across presets, orders and 1–6 players, legal and illegal actions) holding every invariant · face tally equals faces drawn |
| RNG | `rng.more.test.ts` | cyrb128/sfc32 determinism and isolation · salted daily seed · malformed date keys · 365 distinct daily sequences in a year · byte mapping 42 bytes per face · batch refills and all-rejected batches · local date keys |

## AI (`src/ai`)

| Area | File | Scenarios |
|---|---|---|
| Legality | `strategy.scenarios.test.ts` | 300 random views per level: a score is always an allowed box, a keep is never all five dice · always scores after the third roll · deterministic for the same view · with one box left, scores it |
| Expert / Normal / Easy | `strategy.scenarios.test.ts` | Keeps four of a kind for Yatzy · full house with no rolls left · joker chase · upper-bonus completion · Normal's hold rules (pairs, straights, triples) and greedy scoring with the bonus · Easy's chooser clamped to the top three |
| Turn stepping | `strategy.scenarios.test.ts` | One hold toggle per step, release of stale holds, re-planning on new dice, whole games at every level through `nextAiStep` with only legal moves |
| No hidden information | `strategy.scenarios.test.ts` | The view has exactly six visible fields; a Proxy proves `decide` reads nothing else |

## Ads (`src/ads`)

| Area | File | Scenarios |
|---|---|---|
| Policy constants and precedence | `policy.matrix.test.ts` | Constants match CLAUDE.md rule 1 · rule order when several block · session 0/1/2 · games 0/2/3 · game gap 0/1/2 · 4-minute boundary to the millisecond · clock moved back · final-scorecard dwell 0/2999/3000 ms · preload ignores dwell only · full show-wait-show cycle · rewarded cap per calendar day, never touching the interstitial clock · trials restart and expiry · ATT after session 3 on iOS only · Remove Ads card from game 3 |
| Service | `service.test.ts` | init throwing or rejecting means no ads, cached per launch, concurrent init runs once · provider swap resets · show rejecting records nothing · unloaded ad not shown · dismissed rewarded does not count · daily cap stops preload · null provider · privacy options guarded · Supporter Bundle blocks interstitials |
| AdMob wrapper | `service.test.ts` | UMP consent first, muted, rated G · one interstitial loaded at a time, dropped on error · closed resolves true and consumes the ad · 2-second timeout when nothing opens, no timeout once opened · error after open counts as shown · rewarded earned/dismissed/unavailable paths, 2-second load wait, late load within the window · ATT request marks asked, skips where unavailable, never throws |

## Purchases (`src/iap`)

| Area | File | Scenarios |
|---|---|---|
| Products | `nativeStore.test.ts` | Five non-consumables with the bundle prefix, nothing subscription-like · entitlements merge without duplicates · Supporter is a superset |
| Native store | `nativeStore.test.ts` | Connection shared, failed connection retried · product mapping drops foreign ids · owned filters pending and foreign, acknowledges Android purchases, restore syncs on iOS only · purchase event flows: purchased, pending then approved, unknown ids ignored, user cancelled with or without id, already owned, pending/deferred, unknown error fails all open purchases, request rejecting, duplicate buy cancels the first, listener removal |
| Fake and unavailable stores, selection | `nativeStore.test.ts` | Fake store filters and resets · unavailable store fails softly · `EXPO_PUBLIC_FAKE_STORE` picks the fake |

## Data (`src/data`)

| Area | File | Scenarios |
|---|---|---|
| Defaults | `schema.test.ts` | Fresh deep copies, no shared nested objects, JSON round trip, start cosmetics, Classic default, music off |
| Migration chain | `schema.test.ts` | Contiguous versions and file names · v0 and v1 fixtures to the current shape · purchases and streak kept · idempotent last step · no-op at current version · step-wise equals end-to-end |
| Repository across launches | `schema.test.ts` | Launch 1 writes defaults, launch 2 reads only · backup written before the migrated root · second launch after migration · read-only after a newer blob reports once · garbage of the current version served as is · custom target version · a throwing store never crashes load |

## State (`src/state`)

| Area | File | Scenarios |
|---|---|---|
| Game store | `gameStore.scenarios.test.ts` | Start replaces in progress without logging · 200 unique ids · daily is always Classic solo · replay ids share dice · one RNG for people and computers, daily ignores it, switching games keeps each sequence · autosave after every action including computer steps and undo · relaunch mid-computer-turn · read-only safe mode plays in memory · undo ownership across people and computers · aiStep/skipAiTurn bounds, several computers in a row, all-computer table · 3-player log entry (winners, tallies, Yatzys) · unlocks at 10 games and 7-day streak · abandoned games never counted · rollSeq not persisted |
| Daily, stats, log, players | `daily.edge.test.ts` | Id parsing · leap days, year ends, DST · ISO week boundaries · streak: first day, clock moved back, 2-day freeze, freeze week attribution, weekly reset, bestStreak monotonic, 0 locks the day, immutability · 28-day history · stats: losses, ties, mixed tables, all-computer games, legacy entries, rounding · winners with bonuses, upper bonus only for people, previousBest filters · 6-seat cap, trimmed names, remembered table |
| Cloud sync | `cloudSync.props.test.ts` | Merge idempotent, self-merge identity, commutative counters/unlocks/bestStreak, never removes, local-only fields kept, timestamp rules, partial remote settings · strict payload parsing · runner: foreground/background only, stop removes listeners, corrupt payload ignored, read-only mode untouched, remote change merged and pushed, throwing store swallowed |
| Shop store | `shopStore.edge.test.ts` | Concurrent load, cache never shrinks, de-duplication, products-empty store, busy guard across buy/restore, buy rejecting, cancel is silent, restore failures keep ownership, pending approval after reload, cache timestamp · cosmetics catalogue counts, contrast pips, trial key validation, both earned skins at once |

## App-wide (`src/__tests__`)

| Area | File | Scenarios |
|---|---|---|
| Translations | `i18nKeys.test.ts` | Every `t('…')` key in `app/` and `src/` exists · template prefixes resolve · every box, skin, table, level and shop message named · no empty strings, paired plurals, balanced placeholders · "Yatzy" and no trademarks or prices · computer naming · interpolation and plural forms · pseudo-locale edge cases |
| Hard rules | `hardRules.test.ts` | Engine free of React/Expo · only `state/rng.ts` touches expo-crypto · AI cannot reach the generator · no `Math.random() * 6` · no trademark in any shipped file · no currency words or hard-coded prices · no attribution SDKs or photo/contacts/location permissions · interstitial only from the final scorecard · AdMob muted and rated G · schema version equals migration count · nothing deletes the root blob · bundle id and tablet support |
| Screens | `screens.more.test.tsx` | Home: greeting, stats line, finished-game Play, week strip, no ATT before onboarding · New game: no-person validation, 2–6 seats, per-seat levels, close and cancel, rules saved · Table: joker turn, forced order, Scandinavian pad, bonus made, holds across rolls, accessibility settings, daily turn line, 3-person and person-after-computer handoffs · Final: ranking and winner, you win, share and unlock CTA, Play again keeps rules, no first-game personal best · Daily: replace alert, replays exhausted, best and calendar, replay in progress, reminder declined or already on · Stats rows and streaks · Settings: safe-mode warning, reminder hour, tutorial replay, shop link · Onboarding holds · Fairness page |
| Components | `ui.test.tsx` | bestOption · ScorePad row states, hints off, read-only, extra Yatzy row, Scandinavian pad · ScoreGrid current-only buttons and named columns · Segmented and Button accessibility · RollButton, RollPips, PlayerBar, CardTabs, SkipButton, Avatar · Handoff modal and standings · ShareCard holds no names, daily variant, capture at 1080×1350 and failure paths · haptics follow settings and never throw · palettes consistent in light and dark |
| Reminders | `reminderRunner.test.ts` | 7 one-off notifications with per-day ids and the chosen minute · midnight and one-minute-ahead edges, year end · permission asked once, scheduler throwing · refresh never asks · text from en.json, not marketing · runner refreshes at start, on active, and after a daily finishes; not after a normal game; stops cleanly |

## Known gaps (not covered by Jest)

- Real native behaviour: StoreKit sandbox, AdMob test units, haptics, the silent switch, iCloud. These are Maestro flows in `e2e/` plus the manual pass in specs.md §13.
- Layout at large Dynamic Type and iPad landscape is only exercised by the existing wide-layout test; pixel checks need the simulator.
