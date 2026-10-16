import type { AiLevel, GameMode, GameState } from '../engine/game';
import type { PresetId } from '../engine/rules/presets';

/** Bump only together with a new file in migrations/ and its fixture test (CLAUDE.md rule 3). */
export const SCHEMA_VERSION = 1;

export type ThemeMode = 'system' | 'light' | 'dark';

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
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
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
};

export function createDefaultData(): RootData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, dailyReminder: { ...DEFAULT_SETTINGS.dailyReminder } },
    stats: { sessions: 0, gamesCompleted: 0, firstLaunchAt: null },
    gameLog: [],
    inProgress: null,
    unlocks: { dice: ['ivory', 'walnut'], tables: ['felt'] },
    daily: { streak: 0, bestStreak: 0, lastCompleted: null, freezeUsedWeek: null, results: {} },
    purchasesCache: { productIds: [], updatedAt: null },
  };
}
