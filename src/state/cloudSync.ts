import type { DailyState, RootData, Settings, Stats, Unlocks } from '../data/schema';

/**
 * What goes to iCloud key-value storage (specs.md §8): settings, the stats
 * summary, unlocks and the daily streak. Never the game log or a game in
 * progress. Versioned so a later app can read an older payload.
 */
export interface CloudPayload {
  v: 1;
  settings: Settings;
  settingsUpdatedAt: string | null;
  stats: Stats;
  unlocks: Unlocks;
  daily: Omit<DailyState, 'reminderAsked'>;
}

export const CLOUD_KEY = 'dice-den/v1';

export function toPayload(data: RootData): CloudPayload {
  const { reminderAsked: _asked, ...daily } = data.daily;
  return {
    v: 1,
    settings: data.settings,
    settingsUpdatedAt: data.syncMeta.settingsUpdatedAt,
    stats: data.stats,
    unlocks: data.unlocks,
    daily,
  };
}

export function parsePayload(raw: string | null | undefined): CloudPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CloudPayload>;
    if (parsed.v !== 1 || !parsed.settings || !parsed.stats || !parsed.unlocks || !parsed.daily) return null;
    return parsed as CloudPayload;
  } catch {
    return null;
  }
}

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
const later = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a >= b ? a : b);
const earlier = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a <= b ? a : b);

/**
 * Merge rule: max() for counters, union for unlocks, latest timestamp for
 * settings. Daily results are unioned (a date's first result stays locked, so
 * the local one wins a clash) and the streak comes from the newer device.
 */
export function mergeCloud(local: RootData, remote: CloudPayload): RootData {
  const remoteSettingsNewer =
    remote.settingsUpdatedAt !== null &&
    (local.syncMeta.settingsUpdatedAt === null || remote.settingsUpdatedAt > local.syncMeta.settingsUpdatedAt);
  const settings: Settings = remoteSettingsNewer
    ? { ...local.settings, ...remote.settings, onboardingDone: local.settings.onboardingDone || remote.settings.onboardingDone }
    : { ...local.settings, onboardingDone: local.settings.onboardingDone || remote.settings.onboardingDone };

  const ld = local.daily;
  const rd = remote.daily;
  const remoteDailyNewer = (rd.lastCompleted ?? '') > (ld.lastCompleted ?? '');
  const sameDay = rd.lastCompleted === ld.lastCompleted;
  const daily: DailyState = {
    ...ld,
    streak: remoteDailyNewer ? rd.streak : sameDay ? Math.max(ld.streak, rd.streak) : ld.streak,
    lastCompleted: later(ld.lastCompleted, rd.lastCompleted),
    freezeUsedWeek: later(ld.freezeUsedWeek, rd.freezeUsedWeek),
    bestStreak: Math.max(ld.bestStreak, rd.bestStreak),
    results: { ...rd.results, ...ld.results },
  };

  return {
    ...local,
    settings,
    syncMeta: { settingsUpdatedAt: later(local.syncMeta.settingsUpdatedAt, remote.settingsUpdatedAt) },
    stats: {
      sessions: Math.max(local.stats.sessions, remote.stats.sessions),
      gamesCompleted: Math.max(local.stats.gamesCompleted, remote.stats.gamesCompleted),
      firstLaunchAt: earlier(local.stats.firstLaunchAt, remote.stats.firstLaunchAt),
    },
    unlocks: { dice: union(local.unlocks.dice, remote.unlocks.dice), tables: union(local.unlocks.tables, remote.unlocks.tables) },
    daily,
  };
}
