import { updateAppData } from './appData';

/** Counts a cold start (the ad and tracking-prompt rules need the session count). */
export function recordSession(now: Date = new Date()): void {
  updateAppData((d) => ({
    ...d,
    stats: { ...d.stats, sessions: d.stats.sessions + 1, firstLaunchAt: d.stats.firstLaunchAt ?? now.toISOString() },
  }));
}
