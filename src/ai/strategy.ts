import { DICE_COUNT, FACES, MAX_ROLLS, type Face } from '../engine/dice';
import type { AiLevel } from '../engine/game';
import { isUpperBox, UPPER_BOXES, upperFace, type BoxId, type RulePreset } from '../engine/rules/presets';
import { allowedBoxes, extraYatzyBonusFor, scoreFor, totals, type Scorecard } from '../engine/scoring';

/**
 * Everything an AI may look at: the same things a human sees on the table.
 * There is deliberately no RNG here (CLAUDE.md: AIs never get the RNG).
 */
export interface AiView {
  preset: RulePreset;
  card: Scorecard;
  extraYatzyCount: number;
  forcedOrder: boolean;
  dice: readonly Face[];
  rollsUsed: number;
}

export type AiDecision = { type: 'keep'; held: boolean[] } | { type: 'score'; box: BoxId };

/** Picks an index in [0, n): Easy's choice among its top options. Not dice luck. */
export type Chooser = (n: number) => number;

/**
 * Average points a box earns when left open for later, used as the cost of
 * filling it now. Tuned by simulation (see the AI tests); they only need to rank boxes.
 */
const UPPER_OPPORTUNITY = { ones: 2.1, twos: 4.8, threes: 7.8, fours: 10.9, fives: 13.9, sixes: 17.0 };
const OPPORTUNITY: Record<RulePreset['id'], Partial<Record<BoxId, number>>> = {
  classic: {
    ...UPPER_OPPORTUNITY,
    threeKind: 16,
    fourKind: 9,
    fullHouse: 18,
    smallStraight: 22,
    largeStraight: 22,
    yatzy: 14,
    chance: 21.5,
  },
  scandinavian: {
    ...UPPER_OPPORTUNITY,
    onePair: 9.5,
    twoPairs: 14,
    threeKind: 10.5,
    fourKind: 6.5,
    smallStraight: 6,
    largeStraight: 7,
    fullHouse: 12,
    chance: 21.5,
    yatzy: 12,
  },
};

type Dice = readonly Face[];
const keyOf = (dice: Dice) => [...dice].sort().join('');

const multisetCache = new Map<number, { dice: Face[]; p: number }[]>();

/** Every sorted outcome of rolling `n` dice, with its probability. */
export function outcomes(n: number): { dice: Face[]; p: number }[] {
  const cached = multisetCache.get(n);
  if (cached) return cached;
  const result: { dice: Face[]; p: number }[] = [];
  const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
  const walk = (from: number, acc: Face[]) => {
    if (acc.length === n) {
      const counts = FACES.map((f) => acc.filter((d) => d === f).length);
      const ways = factorial(n) / counts.reduce((m, c) => m * factorial(c), 1);
      result.push({ dice: [...acc], p: ways / 6 ** n });
      return;
    }
    for (let f = from; f <= 6; f++) walk(f, [...acc, f as Face]);
  };
  walk(1, []);
  multisetCache.set(n, result);
  return result;
}

/** Heuristic worth of putting `dice` in `box` now: points, minus what the box is worth kept open, plus bonus shaping. */
export function boxValue(view: AiView, box: BoxId, dice: Dice): number {
  const { preset, card } = view;
  const points = scoreFor(preset, card, dice, box) + extraYatzyBonusFor(preset, card, dice);
  let value = points - (OPPORTUNITY[preset.id][box] ?? 0);
  if (isUpperBox(box)) {
    const upper = totals(preset, card, 0).upper;
    if (upper < preset.upperBonusThreshold) {
      const face = upperFace(box);
      // Three of a face keeps you on pace for the bonus; reward above it, punish below.
      value += (points - face * 3) * (preset.upperBonus / 70);
      if (upper + points >= preset.upperBonusThreshold) value += preset.upperBonus * 0.8;
    }
  }
  return value;
}

/**
 * Normal's greedy box choice: the most points now (counting the upper bonus it
 * would complete), and a zero goes where it costs least.
 */
function greedyBoxes(view: AiView, dice: Dice): { box: BoxId; value: number }[] {
  const { preset, card } = view;
  const upper = totals(preset, card, 0).upper;
  return allowedBoxes(preset, card, dice, view.forcedOrder)
    .map((box) => {
      let points = scoreFor(preset, card, dice, box) + extraYatzyBonusFor(preset, card, dice);
      if (isUpperBox(box) && upper < preset.upperBonusThreshold && upper + points >= preset.upperBonusThreshold) {
        points += preset.upperBonus;
      }
      const tieBreak = -(OPPORTUNITY[preset.id][box] ?? 0) / 100;
      return { box, value: points > 0 ? points + tieBreak : tieBreak * 100 - 1000 };
    })
    .sort((a, b) => b.value - a.value);
}

function rankedBoxes(view: AiView, dice: Dice): { box: BoxId; value: number }[] {
  return allowedBoxes(view.preset, view.card, dice, view.forcedOrder)
    .map((box) => ({ box, value: boxValue(view, box, dice) }))
    .sort((a, b) => b.value - a.value);
}

/** Expected-value search over holds for one turn, memoised by dice multiset. */
class Evaluator {
  private stop = new Map<string, number>();
  private value = new Map<string, number>();
  private keep = new Map<string, number>();

  constructor(private readonly view: AiView) {}

  /** Best value of scoring these dice now. */
  stopValue(dice: Dice): number {
    const key = keyOf(dice);
    let v = this.stop.get(key);
    if (v === undefined) {
      v = rankedBoxes(this.view, dice)[0]?.value ?? 0;
      this.stop.set(key, v);
    }
    return v;
  }

  /** Best value reachable from `dice` with `rollsLeft` rolls, playing optimally. */
  best(dice: Dice, rollsLeft: number): number {
    if (rollsLeft === 0) return this.stopValue(dice);
    const key = `${rollsLeft}|${keyOf(dice)}`;
    let v = this.value.get(key);
    if (v === undefined) {
      v = this.stopValue(dice);
      for (const kept of distinctKeeps(dice)) {
        if (kept.length === DICE_COUNT) continue;
        v = Math.max(v, this.keepValue(kept, rollsLeft));
      }
      this.value.set(key, v);
    }
    return v;
  }

  /** Expected value of keeping `kept` and rolling the rest. */
  keepValue(kept: Dice, rollsLeft: number): number {
    const key = `${rollsLeft}|${keyOf(kept)}`;
    let v = this.keep.get(key);
    if (v === undefined) {
      v = 0;
      for (const o of outcomes(DICE_COUNT - kept.length)) v += o.p * this.best([...kept, ...o.dice], rollsLeft - 1);
      this.keep.set(key, v);
    }
    return v;
  }
}

/** Distinct sub-multisets of the dice (at most 32 index subsets). */
function distinctKeeps(dice: Dice): Face[][] {
  const seen = new Map<string, Face[]>();
  for (let mask = 0; mask < 1 << dice.length; mask++) {
    const kept = dice.filter((_, i) => mask & (1 << i));
    seen.set(keyOf(kept), [...kept].sort());
  }
  return [...seen.values()];
}

/** Hold mask that keeps exactly the multiset `kept`, preferring the leftmost dice. */
export function holdMask(dice: Dice, kept: readonly Face[]): boolean[] {
  const remaining = [...kept];
  return dice.map((d) => {
    const i = remaining.indexOf(d);
    if (i === -1) return false;
    remaining.splice(i, 1);
    return true;
  });
}

/** How far ahead the search-based levels plan (in rolls). Normal uses rules instead. */
const LOOKAHEAD: Record<Exclude<AiLevel, 'normal'>, number> = { easy: 1, expert: MAX_ROLLS };

/** Longest run of consecutive faces present, as one die per face. */
function longestRun(dice: Dice): Face[] {
  let best: Face[] = [];
  let run: Face[] = [];
  for (const f of FACES) {
    run = dice.includes(f) ? [...run, f] : [];
    if (run.length > best.length) best = run;
  }
  return best;
}

/**
 * Normal's "simple hold heuristics" (specs.md F4): stand on a made hand, chase a
 * straight, otherwise keep the most common face. Returns null to score now.
 */
export function greedyKeep(view: AiView): Face[] | null {
  const { preset, card, dice } = view;
  const open = (box: BoxId) => preset.boxes.includes(box) && card[box] === undefined;
  const made = (box: BoxId) => open(box) && scoreFor(preset, card, dice, box) > 0;
  const counts = FACES.map((f) => dice.filter((d) => d === f).length);
  const most = Math.max(...counts);

  const classic = preset.id === 'classic';
  if (made('yatzy') || made('largeStraight')) return null;
  if (classic && made('fullHouse')) return null;
  // Scandinavian straights are fixed sets (1-5, 2-6), so a made one can't improve.
  if (made('smallStraight') && (!classic || !open('largeStraight'))) return null;

  const run = longestRun(dice);
  // Classic straights pay 30/40, worth chasing from three in a row; Scandinavian ones only 15/20.
  if ((open('smallStraight') || open('largeStraight')) && run.length >= (classic ? 3 : 4) && most <= 2) return run;

  if (most === 2 && counts.filter((c) => c === 2).length === 2 && (open('fullHouse') || open('twoPairs'))) {
    return dice.filter((d) => counts[d - 1] === 2);
  }
  // Most common face; ties (and near-ties) go to higher faces and faces whose upper box is still open.
  const worth = (f: number) => counts[f - 1] + (open(UPPER_BOXES[f - 1]) ? 0.4 : 0) + f * 0.08;
  let target = 6;
  for (let f = 5; f >= 1; f--) if (worth(f) > worth(target)) target = f;
  if (counts[target - 1] <= 1) return [];
  return dice.filter((d) => d === target);
}

/**
 * What the computer does after a roll: keep some dice and roll again, or score.
 * Easy picks at random among its top 3 one-roll options; Normal follows simple
 * hold rules; Expert searches every hold over all rolls left.
 */
export function decide(view: AiView, level: AiLevel, choose: Chooser = (n) => Math.floor(Math.random() * n)): AiDecision {
  if (view.rollsUsed === 0) throw new Error('The AI decides only after rolling');
  const rollsLeft = MAX_ROLLS - view.rollsUsed;
  const pick = <T>(sorted: T[]): T => {
    if (level !== 'easy') return sorted[0];
    const top = Math.min(3, sorted.length);
    return sorted[Math.max(0, Math.min(top - 1, Math.floor(choose(top))))];
  };

  const boxes = rankedBoxes(view, view.dice);
  if (rollsLeft > 0 && level === 'normal') {
    const kept = greedyKeep(view);
    if (kept && kept.length < DICE_COUNT) return { type: 'keep', held: holdMask(view.dice, kept) };
  } else if (rollsLeft > 0) {
    const evaluator = new Evaluator(view);
    const depth = Math.min(rollsLeft, LOOKAHEAD[level as 'easy' | 'expert']);
    const options: { kept: Face[] | null; value: number }[] = [{ kept: null, value: evaluator.stopValue(view.dice) }];
    for (const kept of distinctKeeps(view.dice)) {
      if (kept.length < DICE_COUNT) options.push({ kept, value: evaluator.keepValue(kept, depth) });
    }
    options.sort((a, b) => b.value - a.value);
    const choice = pick(options);
    if (choice.kept) return { type: 'keep', held: holdMask(view.dice, choice.kept) };
  }
  return { type: 'score', box: pick(level === 'normal' ? greedyBoxes(view, view.dice) : boxes).box };
}
