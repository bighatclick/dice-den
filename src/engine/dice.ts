export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;
export const FACES: readonly Face[] = [1, 2, 3, 4, 5, 6];

/** counts[f] = how many dice show face f (index 0 is unused). */
export function faceCounts(dice: readonly Face[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d] += 1;
  return counts;
}

export function diceSum(dice: readonly Face[]): number {
  return dice.reduce((total, d) => total + d, 0);
}

export function isYatzy(dice: readonly Face[]): boolean {
  return dice.length === DICE_COUNT && dice.every((d) => d === dice[0]);
}
