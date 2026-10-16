import type { DailyState } from '../data/schema';

const DAILY_ID = /^daily-(\d{4}-\d{2}-\d{2})(?:-r\d+)?$/;

export function dailyGameId(dateKey: string, replay = 0): string {
  return replay > 0 ? `daily-${dateKey}-r${replay}` : `daily-${dateKey}`;
}

/** The date a daily game belongs to, from its id. */
export function dailyDateOf(gameId: string): string | null {
  return DAILY_ID.exec(gameId)?.[1] ?? null;
}

function parse(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateKey: string, days: number): string {
  const d = parse(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** ISO 8601 week, e.g. "2026-W42": the free streak-freeze resets each week. */
export function isoWeek(dateKey: string): string {
  const d = parse(dateKey);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Records a finished daily game (specs.md F6). Only the first completion of a
 * date counts; replays never change the result or the streak. One missed day
 * per ISO week is bridged by the free streak-freeze.
 */
export function completeDaily(daily: DailyState, dateKey: string, score: number): DailyState {
  if (daily.results[dateKey] !== undefined) return daily;
  let { streak, freezeUsedWeek } = daily;
  if (daily.lastCompleted === addDays(dateKey, -1)) {
    streak += 1;
  } else if (daily.lastCompleted === addDays(dateKey, -2) && freezeUsedWeek !== isoWeek(dateKey)) {
    streak += 1;
    freezeUsedWeek = isoWeek(dateKey);
  } else {
    streak = 1;
  }
  return {
    ...daily,
    streak,
    bestStreak: Math.max(daily.bestStreak, streak),
    freezeUsedWeek,
    lastCompleted: dateKey,
    results: { ...daily.results, [dateKey]: score },
  };
}

/** The streak as it stands today: it survives until a day is missed (or two, with the freeze unused). */
export function currentStreak(daily: DailyState, today: string): number {
  const last = daily.lastCompleted;
  if (!last) return 0;
  if (last === today || last === addDays(today, -1)) return daily.streak;
  if (last === addDays(today, -2) && daily.freezeUsedWeek !== isoWeek(today)) return daily.streak;
  return 0;
}

/** Last `days` dates ending today, oldest first, with each day's locked score (or null). */
export function dailyHistory(daily: DailyState, today: string, days = 28): { date: string; score: number | null }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, score: daily.results[date] ?? null };
  });
}

/** "October 17" in the device's language, for the screen and the share card. */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
}
