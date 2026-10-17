import type { RootData } from '../data/schema';
import { DICE_SKINS } from '../ui/cosmetics';

/** Games to finish for the first earned skin (specs.md §7.2). */
export const GAMES_FOR_UNLOCK = 10;
/** Daily streak for the second earned skin. */
export const STREAK_FOR_UNLOCK = 7;

/**
 * Grants skins earned by play: one at 10 completed games, one at a 7-day
 * daily streak. Never removes anything. Returns the ids that are new.
 */
export function grantEarnedUnlocks(data: RootData): { data: RootData; newly: string[] } {
  const earned = DICE_SKINS.filter(
    (s) =>
      (s.source === 'games10' && data.stats.gamesCompleted >= GAMES_FOR_UNLOCK) ||
      (s.source === 'streak7' && data.daily.bestStreak >= STREAK_FOR_UNLOCK),
  ).map((s) => s.id);
  const newly = earned.filter((id) => !data.unlocks.dice.includes(id));
  if (newly.length === 0) return { data, newly };
  return { data: { ...data, unlocks: { ...data.unlocks, dice: [...data.unlocks.dice, ...newly] } }, newly };
}
