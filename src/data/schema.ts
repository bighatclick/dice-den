import type { AiLevel, GameMode, GameState } from '../engine/game';
import type { PresetId } from '../engine/rules/presets';

/** Bump only together with a new file in migrations/ and its fixture test (CLAUDE.md rule 3). */
export const SCHEMA_VERSION = 2;

export type ThemeMode = 'system' | 'light' | 'dark';
export type AiSpeed = 'slow' | 'normal' | 'fast';

export interface Settings {
  themeMode: ThemeMode;
  preset: PresetId;
  forcedOrder: boolean;
  hints: boolean;
  sound: boolean;
  haptics: boolean;
  music: boolean;
  largeDice: boolean;
  highContrastPips: boolean;
  leftHanded: boolean;
  dailyReminder: { enabled: boolean; hour: number; minute: number };
  onboardingDone: boolean;
  /** v2: in-app Reduce Motion (on top of the system setting). */
  reduceMotion: boolean;
  /** v2: how fast computer turns play. */
  aiSpeed: AiSpeed;
  /** v2: chosen cosmetics (ids from src/ui/cosmetics.ts). */
  diceSkin: string;
  table: string;
}

export interface GameLogEntry {
  id: string;
  finishedAt: string;
  mode: GameMode;
  preset: PresetId;
  players: { name: string; kind: 'human' | 'ai'; aiLevel?: AiLevel; total: number }[];
  winnerIndexes: number[];
  /** Index 0..5 = faces 1..6, for the fairness chart. */
  humanFaceCounts: number[];
  aiFaceCounts: number[];
  extraYatzys: number;
  /** v2: Yatzys scored by people, including extra ones (older entries lack it). */
  yatzys?: number;
  upperBonusMade: boolean;
}

export interface Stats {
  sessions: number;
  gamesCompleted: number;
  firstLaunchAt: string | null;
}

export interface DailyState {
  streak: number;
  bestStreak: number;
  lastCompleted: string | null;
  /** ISO week (YYYY-Www) in which the free streak-freeze was used. */
  freezeUsedWeek: string | null;
  results: Record<string, number>;
  /** v2: the reminder permission is asked once, after the 2nd daily completion. */
  reminderAsked: boolean;
}

/** v2: everything the ad and review rules need to remember (src/ads/policy.ts). */
export interface AdsState {
  lastInterstitialAt: string | null;
  gamesAtLastInterstitial: number;
  rewarded: { date: string | null; count: number };
  attPrompted: boolean;
  removeAdsCardShown: boolean;
  reviewPrompts: string[];
  lastAdShownAt: string | null;
  /** Cosmetic id → ISO expiry of a rewarded 24 h trial. */
  trials: Record<string, string>;
}

export interface Unlocks {
  dice: string[];
  tables: string[];
}

export interface PurchasesCache {
  productIds: string[];
  updatedAt: string | null;
}

export interface RootData {
  schemaVersion: typeof SCHEMA_VERSION;
  settings: Settings;
  stats: Stats;
  gameLog: GameLogEntry[];
  inProgress: GameState | null;
  unlocks: Unlocks;
  daily: DailyState;
  purchasesCache: PurchasesCache;
  ads: AdsState;
  /** v2: when settings last changed here, for the iCloud merge (latest wins). */
  syncMeta: { settingsUpdatedAt: string | null };
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'dark',
  preset: 'classic',
  forcedOrder: false,
  hints: true,
  sound: true,
  haptics: true,
  music: false,
  largeDice: false,
  highContrastPips: false,
  leftHanded: false,
  dailyReminder: { enabled: false, hour: 19, minute: 0 },
  onboardingDone: false,
  reduceMotion: false,
  aiSpeed: 'normal',
  diceSkin: 'ivory',
  table: 'felt',
};

export const DEFAULT_ADS: AdsState = {
  lastInterstitialAt: null,
  gamesAtLastInterstitial: 0,
  rewarded: { date: null, count: 0 },
  attPrompted: false,
  removeAdsCardShown: false,
  reviewPrompts: [],
  lastAdShownAt: null,
  trials: {},
};

export function createDefaultData(): RootData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, dailyReminder: { ...DEFAULT_SETTINGS.dailyReminder } },
    stats: { sessions: 0, gamesCompleted: 0, firstLaunchAt: null },
    gameLog: [],
    inProgress: null,
    unlocks: { dice: ['ivory', 'walnut'], tables: ['felt'] },
    daily: { streak: 0, bestStreak: 0, lastCompleted: null, freezeUsedWeek: null, results: {}, reminderAsked: false },
    purchasesCache: { productIds: [], updatedAt: null },
    ads: { ...DEFAULT_ADS, rewarded: { ...DEFAULT_ADS.rewarded }, reviewPrompts: [], trials: {} },
    syncMeta: { settingsUpdatedAt: null },
  };
}
