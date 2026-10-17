# Dice Den: Yatzy Classic (product spec v1.0)

Status: ready to build · Research date: 16 Oct 2026 · Owner: @Utkarsh
Research sources:
- `../../research/yatzy_section9.md`: competitors, review mining, paywall, requirements YZ-R01…R25
- `../../research/keywords_full.md`: keywords, store metadata, naming
- `../../Game_Picks_2026-10.md`: market data and scoring

---

## 1. Product summary

| Item | Decision |
|---|---|
| One-line positioning | The classic dice game, made calm again: honest dice, no interruptions mid-game, and the whole family around one phone. |
| Platforms | iOS first (iPhone + iPad, universal), then Google Play once the closed test clears |
| Target market | US first, then UK / CA / AU. Players 30+, families, older casual players |
| Game | Classic Yatzy (5 dice, 3 rolls, 13 or 15 boxes), solo, vs AI, local pass-and-play |
| Growth | Organic only: ASO, ratings, share card, daily challenge streak |
| Monetisation | Between-game interstitials (capped), opt-in rewarded ads, one-time Remove Ads, cosmetic dice/table packs. No currency, no subscriptions |
| Running cost | $0 per user: no backend, no login, no AI APIs |
| Build budget | v1.0 core in ~4–6 h of Claude Code time + polish/testing; store prep separate |
| Success metrics (M3) | Rating ≥ 4.7 (recent reviews too), crash-free sessions ≥ 99.8%, D1 ≥ 40%, D7 ≥ 15%, remove-ads conversion ≥ 1.5% of MAU |

**Trademark rule:** never use "Yahtzee", "Kniffel" or "Yatzee" anywhere we ship (code strings, metadata, screenshots, IAP names). Call the 5-of-a-kind box **"Yatzy"**.

---

## 2. Store listing

| Field | Value |
|---|---|
| iOS title | Dice Den: Yatzy Classic |
| iOS subtitle | Dice game for family & friends |
| iOS keyword field | games,roll,scorecard,offline,party,board,yacht,poker,strategy,luck,solo,bonus,pass,play,relaxing |
| Play name | Dice Den: Yatzy Dice Game |
| Play short description | Classic Yatzy dice game. Play a fair AI or pass the phone to family. Offline. |
| Display name (home screen) | Dice Den |
| Bundle ID / package | `com.dicedengame.app` (domain dicedengame.com; register before first upload) |
| Category | Games › Board (secondary: Dice / Family) |
| Age rating | 4+ (iOS); Play: target audience 18+ (playbook: avoid Families policy), content rating Everyone |
| Screenshot messages (store-safe) | 1) "Classic Yatzy, just like the score pad you grew up with" 2) "Pass the phone and play with up to 6 at the table" 3) "Fair dice you can check: see every roll in your stats" 4) "Today's dice: same roll for everyone" 5) "Big dice, dark mode, made for every eye" |
| Banned in all metadata and screenshots | "free", "no ads", "ad-free", "#1", "best", emoji, competitor names, Yahtzee/Kniffel |
| Long description | Repeat "Yatzy", "dice game", "dice games", "classic" naturally 2–4× each; no keyword stuffing |

---

## 3. Scope

### v1.0 (MVP: must ship)
YZ-R01 backup/migration · R02 ad rules · R03 crash-free + autosave · R04 scoring engine · R05 solo + 3-level AI · R06 pass-and-play 2–6 · R07 Remove Ads · R08 muted ads + content filters · R09 offline · R10 undo · R11 layout + accessibility · R12 stats incl. dice distribution · R13 rule presets · R14 daily challenge + streak + share card · R16 hints toggle · R18 rewarded rules · R19 tracking prompt timing · R20 final scorecard review · R21 size < 80 MB.

### v1.1 (2–3 weeks after launch, "fresh app" update)
R15 skin and table packs, if not in v1.0 (the IAP products can ship in v1.0 with 2 packs) · R17 Game Center leaderboards + achievements · localisation (see §11).

### Later
R22 async play with a friend (Game Center turn-based) · R23 Maxi Yatzy (6 dice) + Triple mode · R24 home-screen widget.

### Never (R25)
Online random PvP, chat, tournaments, currency/gems, extra rolls, spin wheels, scratchers, energy/lives, subscriptions, offerwalls.

---

## 4. Game rules

### 4.1 Core loop
5 dice; up to 3 rolls per turn; tap dice to hold or release between rolls; after any roll, the player may score one empty box. The game ends when every player has filled every box.

### 4.2 Presets (Settings › Rules; chosen per game on the new-game sheet)
| Preset | Boxes | Upper bonus | Yatzy | Extra Yatzys | Default? |
|---|---|---|---|---|---|
| **Classic** (US-style, 13 boxes) | Ones–Sixes; 3 of a kind (sum), 4 of a kind (sum), Full House 25, Small Straight (4) 30, Large Straight (5) 40, Yatzy 50, Chance (sum) | +35 at 63+ | 50 | +100 bonus each + joker rule (see below) | **Yes**: the familiar US score pad |
| **Scandinavian Yatzy** (15 boxes) | Ones–Sixes; One Pair, Two Pairs, 3 of a kind, 4 of a kind, Small Straight 1-2-3-4-5 = 15, Large Straight 2-3-4-5-6 = 20, Full House (sum), Chance, Yatzy 50 | +50 at 63+ | 50 | none | No |
| **Free order / Forced order** | toggle on either preset: forced = boxes must be filled top to bottom | – | – | – | Free |

Joker rule (Classic): if you roll a Yatzy and the Yatzy box already holds 50, you get +100. You must score the matching upper box if it is empty; otherwise any lower box, with Full House / Small / Large Straight scoring full value.

Why Classic is the default: the target market is the US, and US players know the 13-box pad. The research suggested Scandinavian as default (YZ-R13); this spec overrides that because the US is first and offers Scandinavian one tap away on the new-game sheet.

### 4.3 Dice and randomness (trust feature)
- Normal games: each die face comes from `expo-crypto` `getRandomBytes` (uniform, rejection sampling, no modulo bias).
- The **same RNG** is used for every player and every AI. No difficulty-based luck, no "pity" rolls, no comeback help (YZ-R05).
- **Daily challenge**: deterministic seeded PRNG (sfc32) seeded from `YYYY-MM-DD` + constant salt, so everyone gets the same dice sequence that day. Store-safe line: "Today's dice: same roll for everyone".
- Stats screen shows the face distribution of every die the player has rolled (counts + % vs 16.7%) and, separately, of AI dice.
- Settings › About fairness: a plain-language page explaining the RNG ("every face has an equal 1-in-6 chance; the computer uses the same dice").

---

## 5. Screens and flows

| # | Screen | Contents |
|---|---|---|
| S1 | Home | Big "Play" (resumes the game in progress if any), "Daily dice" card with streak flame + today's status, "Pass & Play", "Stats", settings gear. No ads here. |
| S2 | New game sheet | Opponents: Solo / vs AI (Easy · Normal · Expert) / Pass & Play (2–6 names, each human or AI); rule preset; forced order toggle. Remembers last choice. |
| S3 | Game table | Dice tray (5 dice, tap to hold), Roll button with roll count (3 dots), score pad (current player's column highlighted; other players' columns visible on iPad / landscape, swipe on phone). Potential scores shown in grey when hints are on. Undo chip appears after scoring until the next roll. |
| S4 | Pass handoff | Full-screen "Pass to Mom" with name + colour, tap to start; hides the previous player's dice. |
| S5 | Final scorecard | Full pad for all players, winner banner, personal best badge, "Share" button (S8), "Play again", "Home". The interstitial (if due) only appears **after** the player taps Play again or Home, and never before 3 s on this screen. |
| S6 | Stats | Games, wins by opponent, high score, average, Yatzys, upper-bonus rate, dice distribution chart (player vs AI), daily streak history. |
| S7 | Daily dice | Seeded game vs nobody (beat your score). One attempt counts; replay allowed via rewarded ad or after midnight. Streak + calendar. |
| S8 | Share card | 1080×1350 image: "Dice Den · Today's dice · 287" with the score pad mini, date, app name/URL. Generated with `react-native-view-shot`, shared with `expo-sharing`. |
| S9 | Shop | Remove Ads, dice packs, table packs, Supporter Bundle, Restore Purchases, rewarded "try for 24 h" buttons. Prices from StoreKit. |
| S10 | Settings | Rules, hints, sound, haptics, music, dark mode (System/Light/Dark), large dice, high-contrast pips, left-hand layout, reduce motion, daily reminder (opt-in), Restore Purchases, About fairness, privacy and terms links, data backup status. |
| S11 | First run | One interactive tutorial turn (roll, hold, score) + the rules preset picker. Skippable. No permission prompts. |

Navigation: expo-router stack; the game table is full-screen. Back from the table asks "Leave game? It's saved." (no loss).

---

## 6. Functional requirements (acceptance criteria)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| F1 (R04) | Scoring engine | Pure TS module `engine/scoring.ts`; 100% branch coverage; table-driven tests for every box in both presets incl. joker, bonus thresholds 62/63, forced order. |
| F2 (R03) | Autosave | Game state persisted after every roll, hold change and score. Kill the app in any state, relaunch → identical state. Tested in an e2e flow. |
| F3 (R10) | Undo | Undo the last score placement until the next roll; no timer; one level. |
| F4 (R05) | AI | Easy: picks randomly among the top 3 expected-value options. Normal: greedy expected value with simple hold heuristics. Expert: expected-value search over hold patterns (enumerate 32 holds × outcomes, depth = rolls left) with a lookup cache. Never sees future dice. AI turn animates at the chosen speed; tap to skip. AI players are named "Computer (Normal)". |
| F5 (R06) | Pass-and-play | 2–6 players, any mix of humans and AI; names + colours remembered; handoff screen between humans. |
| F6 (R14) | Daily dice | Same sequence for all players on a date; result locked after the first completion; streak counts consecutive days completed; 1 free streak-freeze per week; never charged to restore a streak. |
| F7 (R12) | Stats | All stats computed locally from the game log; per-preset filters. |
| F8 (R16) | Hints | Shows potential points in empty boxes; off switch; never auto-scores. |
| F9 (R20) | Final review | Final scorecard always shown first; no ad, prompt or popup may cover it. |
| F10 | Review prompt | `expo-store-review` only after (a) a win or a personal best, (b) ≥ 5 games completed, (c) not in the first 2 days; max 3 per year; never after an ad. |
| F11 | Share card | Available on the final scorecard and daily result; contains no personal data. |
| F12 | Sound and haptics | Dice roll sound and haptic on roll and hold; respect the iOS silent switch (`playsInSilentModeIOS: false`); all ads muted by default (`setAppMuted(true)`). |
| F13 | Daily reminder | Opt-in local notification (expo-notifications), asked only after the 2nd daily completion; one per day at the user's chosen time; never marketing. |

---

## 7. Monetisation

### 7.1 Ads (react-native-google-mobile-ads / AdMob)
| Rule | Value |
|---|---|
| Interstitial placement | Only after leaving the final scorecard (S5 → Play again / Home) |
| Frequency | None in session 1 or before 3 completed games; then at most 1 per 2 completed games and 1 per 4 minutes |
| Never | During a game, on app open, on the handoff screen, before the final scorecard, inside the daily dice |
| Banners | None in v1.0 (they clutter the pad; complaint driver) |
| Rewarded (opt-in only) | "Try this dice set for 24 h", "Replay today's dice". Cap 3/day. Still available after Remove Ads. Never extra rolls or score help |
| Audio | Ads muted (`MobileAds().setAppMuted(true)`, `setAppVolume(0)`) |
| Content | AdMob blocked categories: gambling, dating, sexual, get-rich, alcohol, politics; max ad content rating **G** |
| Consent | Google UMP form on first launch in EEA/UK (required before ad requests); ATT pre-prompt + system prompt only after the 3rd session and never during a game. If declined, serve non-personalised ads |
| Failure handling | Ad load or show errors never block navigation; 2-second timeout then continue |

### 7.2 In-app purchases (expo-iap; all non-consumable)
| Product ID | Name | Price (US) | Contents |
|---|---|---|---|
| `com.dicedengame.app.removeads` | Remove Ads | $3.99 | Removes all interstitials, forever; rewarded stays opt-in |
| `com.dicedengame.app.pack.classic` | Classic Dice Pack | $1.99 | 4 dice skins (bone, casino red, marble, glass) |
| `com.dicedengame.app.pack.tables` | Table Pack | $1.99 | 4 tables (walnut, slate, night, oxblood felt; green felt is the starting table) |
| `com.dicedengame.app.complete` | Complete Collection | $6.99 | All current skins + tables |
| `com.dicedengame.app.supporter` | Supporter Bundle | $9.99 | Remove Ads + all current and future skins/tables |

- Free cosmetics: 2 dice skins + 1 table at start; 1 skin unlocked at 10 games and at a 7-day daily streak (earnable by play).
- Paywall text (3.1.2): price, what's included, "one-time purchase", Restore Purchases, Terms + Privacy links. No fake discounts, timers or "limited offer".
- Remove Ads is offered (a) in Settings and the Shop, (b) once as a small card on the final scorecard after game 3, (c) never as a pop-up mid-play.

---

## 8. Data, persistence and backup (YZ-R01, MUST)

| Item | Decision |
|---|---|
| Store | `react-native-mmkv` (sync, fast) via a typed repository; zustand stores hydrate from it |
| Schema | Single root object `{ schemaVersion: number, settings, stats, gameLog[], inProgress, unlocks, daily, purchasesCache }` |
| Migrations | `data/migrations/NNN-description.ts`, ordered; each has a fixture test that loads a saved JSON from the previous version and asserts the output. **No release may ship without a migration test for every schema change.** |
| Safety | Before migrating, copy the raw blob to `backup_v{old}`; if migration throws, keep the old data, log to Sentry, and run in read-only safe mode (never wipe) |
| iCloud backup | MMKV files live in the app's Documents/Application Support, which is included in device iCloud backups (default) |
| Cross-device sync | Local Expo module `modules/cloud-kv` (Swift `NSUbiquitousKeyValueStore`, Kotlin no-op until v1.1 Play Games Saved Games) syncing `settings`, `stats summary`, `unlocks`, `daily.streak`. Merge rule: max() for counters, union for unlocks, latest-timestamp for settings |
| Purchases | Source of truth = StoreKit / Play Billing; local cache only for offline launch; Restore Purchases in Settings and Shop |
| Android | `android:allowBackup="true"` + Auto Backup rules include the MMKV directory |

---

## 9. Design system: "Den" (unique to this app; don't reuse in other apps)

| Token | Value |
|---|---|
| Mood | A warm wooden games den: walnut table, cream score pad, ivory dice |
| Colours (light) | bg `#F6EFE3` (cream paper) · surface `#FFFFFF` · ink `#2B1D14` · primary `#7A3E1D` (walnut) · accent `#2E6B4F` (felt green) · gold `#C9952B` (bonus) · danger `#B23A2E` |
| Colours (dark) | bg `#17110D` · surface `#231A14` · ink `#F3E9DA` · primary `#D08A55` · accent `#5FA785` · gold `#E1B85A` |
| Typography | Headings: **Fraunces** (expo-google-fonts) 600; body + numbers: **Inter** with tabular numerals; score pad uses tabular figures |
| Dice | Rounded-square SVG dice (react-native-svg), ivory with dark pips; held dice raise 6 pt and show a felt-green ring; roll = 450 ms tumble (Reanimated) + haptic `impactMedium` |
| Score pad | Paper texture, ruled lines, handwritten-style digit animation on score (Inter, not a script font, for legibility) |
| Motion | Reanimated 3; respect Reduce Motion (cross-fade instead of tumble) |
| Sound | Wooden dice-in-cup rattle, soft click on hold, chime on Yatzy; music off by default |
| Icon | Two ivory dice on walnut, showing 5 and 6, no text |

Layout: phone portrait (pad below dice), phone landscape and iPad (pad beside dice, all players' columns visible). Safe-area aware (no notch clipping).

---

## 10. Accessibility (YZ-R11)
Dynamic Type up to XXL on all text (score pad scales; switches to a single-column layout when large); VoiceOver labels ("Die 3, showing 5, held"); "Roll" announces the results; high-contrast pips option; large-dice option; left-hand mode (Roll button on the left); colour never the only signal (held = ring + raised + label); minimum touch target 44 pt.

---

## 11. Internationalisation (playbook 12c)
- `expo-localization` + `i18next`; every UI string lives in `src/i18n/en.json`; no hard-coded text or prices (prices from StoreKit).
- Layouts tolerate +40% text length and CJK; a pseudo-locale (`xx`, accented and 40% longer) is checked before release.
- Store text lives in `store/en/` (title, subtitle, keywords, description, screenshot captions).
- v1.0 English only. Update 1: localise only if a local keyword has popularity ≥ 40 and competition median ≤ 5K ratings (check DE "kniffel" is a trademark, so use "würfelspiel"; also NL, JP, KR, GB, AU), crash-free > 99.5% and rating ≥ 4.3.

---

## 12. Technical architecture

| Layer | Choice |
|---|---|
| Framework | Expo (latest stable SDK at build time) + React Native + TypeScript strict; expo-router |
| State | zustand (game, settings, shop) + MMKV persistence |
| Engine | `src/engine/` pure TS, no React imports: `dice.ts`, `rng.ts` (crypto + sfc32), `scoring.ts`, `rules/` (presets), `ai/` (easy/normal/expert), `game.ts` (reducer: roll/hold/score/undo/next) |
| Rendering | react-native-svg dice, Reanimated 3, react-native-gesture-handler |
| Ads | react-native-google-mobile-ads (AdMob + UMP) |
| IAP | expo-iap (StoreKit 2 / Play Billing; the Expo build of react-native-iap, which does not support Expo dev clients) |
| Other | expo-haptics, expo-audio, expo-crypto, expo-store-review, expo-notifications, expo-sharing, react-native-view-shot, expo-tracking-transparency, @sentry/react-native (free tier, crash reporting only) |
| Not allowed | Attribution SDKs (AppsFlyer, Adjust …), analytics that track across apps, any backend, login, photo/contacts permissions |
| Build | Local on the rented Mac: `npx expo prebuild`, `npx expo run:ios`, `eas build --local -p ios`; push to GitHub at the end of every session |

Folder layout:
```
app/                 expo-router screens (index, game, daily, stats, shop, settings, onboarding)
src/engine/          pure game logic + tests
src/ai/              AI strategies + tests
src/state/           zustand stores
src/data/            mmkv repo, schema, migrations/ (+ fixtures)
src/ads/ src/iap/    wrappers with frequency-cap logic (unit-tested)
src/ui/              Den design system: tokens.ts, Dice.tsx, ScorePad.tsx, Button.tsx …
src/i18n/            en.json, i18n.ts
modules/cloud-kv/    local Expo module (iCloud KV)
store/en/            listing text + screenshot captions
```

---

## 13. Testing and definition of done
- Unit (Jest): scoring 100% branches; RNG uniformity test (1M rolls, chi-square p > 0.01); AI never reads future dice (the engine API gives the AI only the current state); ad frequency cap logic; migrations with fixtures.
- Component tests (React Native Testing Library): score pad, hold toggling, undo.
- E2E (Maestro, on the simulator): new game → 13 turns → final scorecard; kill and resume mid-turn; purchase flow in a StoreKit test configuration; Remove Ads hides interstitials.
- Manual pass on one real iPhone before submission (haptics, sound vs silent switch, ATT).
- Performance: cold start < 2 s on iPhone 11; app download < 80 MB; 60 fps dice animation.
- Done = all MUST requirements pass, tests green, no TypeScript errors, no console warnings, pseudo-locale checked, store text and screenshots ready.

---

## 14. Store compliance checklist (playbook 12b)
- [ ] 4.3: own design system, icons and code; not a copy of our other apps (Farkle Ranch shares a genre, so it uses no shared UI kit). Submit 1–2 weeks apart.
- [ ] 4.2: real features (AI, pass-and-play, daily, stats).
- [ ] 2.3.7 / Play metadata: no "free", "no ads", "#1", "best", emoji, caps or competitor names.
- [ ] 2.1: App Review notes explain ad rules, Remove Ads, packs and that rewarded ads are optional; sandbox-tested purchases.
- [ ] 3.1.1 / 3.1.2: IAP via StoreKit; Restore Purchases; clear prices (no subscriptions in this app).
- [ ] Privacy: App Privacy labels cover AdMob (device ID, usage, diagnostics) and Sentry (crash data); privacy policy and terms hosted at dicedengame.com.
- [ ] Ads consent: UMP (EEA/UK) and an ATT soft prompt after the 3rd session.
- [ ] Play: target audience 18+, no kid-style art, Data safety form, closed test with 12 testers × 14 days started on day 1.
- [ ] No trademarks (Yahtzee, Kniffel, Yatzee) in name, keywords, IAP names, screenshots or in-app text.

---

## 15. Build plan (Claude Code sessions)
| Step | Est. | Output |
|---|---|---|
| 1 | 45 min | Expo scaffold, design tokens, fonts, navigation, MMKV repo + schema v1 + migration framework |
| 2 | 60 min | Engine: RNG, scoring (both presets), game reducer, tests |
| 3 | 60 min | Game table UI: dice, hold, roll, score pad, undo, autosave, final scorecard |
| 4 | 45 min | AI (3 levels) + pass-and-play + handoff |
| 5 | 45 min | Daily dice + streak + share card + stats with dice distribution |
| 6 | 45 min | Ads (UMP, ATT timing, caps) + IAP (5 products, restore) + shop |
| 7 | 30 min | Settings, accessibility, dark mode, onboarding, i18n pass, pseudo-locale |
| 8 | 30 min | iCloud KV module, e2e flows, performance check, store text in `store/en/` |
