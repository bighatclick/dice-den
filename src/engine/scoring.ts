import { diceSum, faceCounts, isYatzy, type Face } from './dice';
import { isUpperBox, upperFace, UPPER_BOXES, type BoxId, type RulePreset } from './rules/presets';

export type Scorecard = Partial<Record<BoxId, number>>;

const YATZY_SCORE = 50;
const CLASSIC_FULL_HOUSE = 25;
const CLASSIC_SMALL_STRAIGHT = 30;
const CLASSIC_LARGE_STRAIGHT = 40;
const SCANDI_SMALL_STRAIGHT = 15;
const SCANDI_LARGE_STRAIGHT = 20;

function hasRun(counts: number[], from: number, length: number): boolean {
  for (let f = from; f < from + length; f++) if (counts[f] === 0) return false;
  return true;
}

function isFullHouse(counts: number[]): boolean {
  return counts.includes(3) && counts.includes(2);
}

/** Highest face that appears at least `n` times, or 0. */
function highestOfAKind(counts: number[], n: number): number {
  for (let f = 6; f >= 1; f--) if (counts[f] >= n) return f;
  return 0;
}

/** What `dice` scores in `box`, ignoring the joker rule. */
export function rawScore(preset: RulePreset, box: BoxId, dice: readonly Face[]): number {
  if (!preset.boxes.includes(box)) throw new Error(`Box ${box} is not part of the ${preset.id} preset`);
  const counts = faceCounts(dice);
  const total = diceSum(dice);
  if (isUpperBox(box)) return counts[upperFace(box)] * upperFace(box);

  const classic = preset.id === 'classic';
  switch (box) {
    case 'onePair':
      return highestOfAKind(counts, 2) * 2;
    case 'twoPairs': {
      const pairs = [6, 5, 4, 3, 2, 1].filter((f) => counts[f] >= 2);
      return pairs.length >= 2 ? (pairs[0] + pairs[1]) * 2 : 0;
    }
    case 'threeKind': {
      const f = highestOfAKind(counts, 3);
      if (f === 0) return 0;
      return classic ? total : f * 3;
    }
    case 'fourKind': {
      const f = highestOfAKind(counts, 4);
      if (f === 0) return 0;
      return classic ? total : f * 4;
    }
    case 'fullHouse':
      if (!isFullHouse(counts)) return 0;
      return classic ? CLASSIC_FULL_HOUSE : total;
    case 'smallStraight':
      if (classic) {
        return hasRun(counts, 1, 4) || hasRun(counts, 2, 4) || hasRun(counts, 3, 4) ? CLASSIC_SMALL_STRAIGHT : 0;
      }
      return hasRun(counts, 1, 5) ? SCANDI_SMALL_STRAIGHT : 0;
    case 'largeStraight':
      if (classic) return hasRun(counts, 1, 5) || hasRun(counts, 2, 5) ? CLASSIC_LARGE_STRAIGHT : 0;
      return hasRun(counts, 2, 5) ? SCANDI_LARGE_STRAIGHT : 0;
    case 'yatzy':
      return isYatzy(dice) ? YATZY_SCORE : 0;
    case 'chance':
      return total;
  }
}

/**
 * Joker rule (Classic, specs.md §4.2): a Yatzy rolled while the Yatzy box already
 * holds 50 earns the extra-Yatzy bonus and restricts where it may be scored.
 */
export function isJokerActive(preset: RulePreset, card: Scorecard, dice: readonly Face[]): boolean {
  return preset.joker && isYatzy(dice) && card.yatzy === YATZY_SCORE;
}

export function openBoxes(preset: RulePreset, card: Scorecard): BoxId[] {
  return preset.boxes.filter((box) => card[box] === undefined);
}

export function isCardComplete(preset: RulePreset, card: Scorecard): boolean {
  return openBoxes(preset, card).length === 0;
}

/** Boxes the player may score `dice` in right now. */
export function allowedBoxes(
  preset: RulePreset,
  card: Scorecard,
  dice: readonly Face[],
  forcedOrder: boolean,
): BoxId[] {
  const open = openBoxes(preset, card);
  if (forcedOrder) return open.slice(0, 1);
  if (!isJokerActive(preset, card, dice)) return open;

  const matching = UPPER_BOXES[dice[0] - 1];
  if (open.includes(matching)) return [matching];
  const lowerOpen = open.filter((box) => !isUpperBox(box));
  return lowerOpen.length > 0 ? lowerOpen : open;
}

/** Points for scoring `dice` in `box`, with the joker rule applied. */
export function scoreFor(preset: RulePreset, card: Scorecard, dice: readonly Face[], box: BoxId): number {
  if (isJokerActive(preset, card, dice)) {
    if (box === 'fullHouse') return CLASSIC_FULL_HOUSE;
    if (box === 'smallStraight') return CLASSIC_SMALL_STRAIGHT;
    if (box === 'largeStraight') return CLASSIC_LARGE_STRAIGHT;
  }
  return rawScore(preset, box, dice);
}

/** Extra-Yatzy bonus earned by scoring this roll (0 or the preset's bonus). */
export function extraYatzyBonusFor(preset: RulePreset, card: Scorecard, dice: readonly Face[]): number {
  return isJokerActive(preset, card, dice) ? preset.extraYatzyBonus : 0;
}

/** Hint values for every box the player may score in now. */
export function potentialScores(
  preset: RulePreset,
  card: Scorecard,
  dice: readonly Face[],
  forcedOrder: boolean,
): Scorecard {
  const result: Scorecard = {};
  for (const box of allowedBoxes(preset, card, dice, forcedOrder)) result[box] = scoreFor(preset, card, dice, box);
  return result;
}

export interface Totals {
  upper: number;
  upperBonus: number;
  lower: number;
  extraYatzyBonus: number;
  total: number;
}

export function totals(preset: RulePreset, card: Scorecard, extraYatzyCount: number): Totals {
  let upper = 0;
  let lower = 0;
  for (const box of preset.boxes) {
    const value = card[box] ?? 0;
    if (isUpperBox(box)) upper += value;
    else lower += value;
  }
  const upperBonus = upper >= preset.upperBonusThreshold ? preset.upperBonus : 0;
  const extraYatzyBonus = extraYatzyCount * preset.extraYatzyBonus;
  return { upper, upperBonus, lower, extraYatzyBonus, total: upper + upperBonus + lower + extraYatzyBonus };
}
