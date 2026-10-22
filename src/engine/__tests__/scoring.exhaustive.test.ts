import { faceCounts, FACES, type Face } from '../dice';
import { CLASSIC, SCANDINAVIAN, isUpperBox, UPPER_BOXES, type BoxId, type RulePreset } from '../rules/presets';
import {
  allowedBoxes,
  extraYatzyBonusFor,
  isJokerActive,
  openBoxes,
  potentialScores,
  rawScore,
  scoreFor,
  totals,
  type Scorecard,
} from '../scoring';

/**
 * Every one of the 6^5 = 7776 ordered rolls is scored in every box of both
 * presets and checked against an independent, deliberately naive reference
 * implementation written straight from specs.md §4.2. If scoring.ts and this
 * file ever disagree, one of them misreads the rules.
 */

function* allRolls(): Generator<Face[]> {
  for (const a of FACES) for (const b of FACES) for (const c of FACES) for (const d of FACES) for (const e of FACES) yield [a, b, c, d, e];
}

const sum = (dice: readonly Face[]) => dice.reduce<number>((t, d) => t + d, 0);
const sorted = (dice: readonly Face[]) => [...dice].sort((a, b) => a - b);
const uniqueSorted = (dice: readonly Face[]) => [...new Set(dice)].sort((a, b) => a - b);
const hasSequence = (dice: readonly Face[], seq: number[]) => seq.every((f) => dice.includes(f as Face));

/** Independent reference: spelled out box by box, no shared helpers with scoring.ts. */
function reference(preset: RulePreset, box: BoxId, dice: readonly Face[]): number {
  const counts = faceCounts(dice);
  const classic = preset.id === 'classic';
  const ofAKind = (n: number) => [6, 5, 4, 3, 2, 1].find((f) => counts[f] >= n) ?? 0;
  switch (box) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes': {
      const face = UPPER_BOXES.indexOf(box) + 1;
      return dice.filter((d) => d === face).length * face;
    }
    case 'onePair':
      return ofAKind(2) * 2;
    case 'twoPairs': {
      const pairs = [6, 5, 4, 3, 2, 1].filter((f) => counts[f] >= 2);
      return pairs.length >= 2 ? pairs[0] * 2 + pairs[1] * 2 : 0;
    }
    case 'threeKind': {
      const f = ofAKind(3);
      return f === 0 ? 0 : classic ? sum(dice) : f * 3;
    }
    case 'fourKind': {
      const f = ofAKind(4);
      return f === 0 ? 0 : classic ? sum(dice) : f * 4;
    }
    case 'fullHouse': {
      const s = sorted(dice);
      const three2 = s[0] === s[1] && s[1] === s[2] && s[3] === s[4] && s[2] !== s[3];
      const two3 = s[0] === s[1] && s[2] === s[3] && s[3] === s[4] && s[1] !== s[2];
      if (!three2 && !two3) return 0;
      return classic ? 25 : sum(dice);
    }
    case 'smallStraight':
      if (classic) {
        return hasSequence(dice, [1, 2, 3, 4]) || hasSequence(dice, [2, 3, 4, 5]) || hasSequence(dice, [3, 4, 5, 6]) ? 30 : 0;
      }
      return uniqueSorted(dice).join('') === '12345' ? 15 : 0;
    case 'largeStraight':
      if (classic) return uniqueSorted(dice).join('') === '12345' || uniqueSorted(dice).join('') === '23456' ? 40 : 0;
      return uniqueSorted(dice).join('') === '23456' ? 20 : 0;
    case 'yatzy':
      return new Set(dice).size === 1 ? 50 : 0;
    case 'chance':
      return sum(dice);
  }
}

describe.each([CLASSIC, SCANDINAVIAN])('rawScore matches the reference for every roll ($id)', (preset) => {
  it.each(preset.boxes)('%s', (box) => {
    let checked = 0;
    for (const dice of allRolls()) {
      const got = rawScore(preset, box, dice);
      const want = reference(preset, box, dice);
      if (got !== want) throw new Error(`${preset.id}/${box} with ${dice.join('')}: got ${got}, expected ${want}`);
      checked++;
    }
    expect(checked).toBe(7776);
  });
});

/** Collects failures over a big loop so one expect() reports them all (expect per iteration is slow). */
function failures(run: (fail: (msg: string) => void) => void): string[] {
  const out: string[] = [];
  run((msg) => void (out.length < 20 && out.push(msg)));
  return out;
}

describe('scoring invariants over every roll', () => {
  it('is independent of dice order', () => {
    expect(
      failures((fail) => {
        for (const preset of [CLASSIC, SCANDINAVIAN]) {
          for (const dice of allRolls()) {
            const reversed = [...dice].reverse();
            for (const box of preset.boxes) {
              if (rawScore(preset, box, reversed) !== rawScore(preset, box, dice)) fail(`${preset.id}/${box} ${dice.join('')}`);
            }
          }
        }
      }),
    ).toEqual([]);
  });

  it('never returns a negative or fractional score, and upper boxes never exceed 5 × face', () => {
    expect(
      failures((fail) => {
        for (const preset of [CLASSIC, SCANDINAVIAN]) {
          for (const dice of allRolls()) {
            for (const box of preset.boxes) {
              const s = rawScore(preset, box, dice);
              if (!Number.isInteger(s) || s < 0) fail(`${preset.id}/${box} ${dice.join('')} = ${s}`);
              if (isUpperBox(box) && s > 5 * (UPPER_BOXES.indexOf(box) + 1)) fail(`${box} ${dice.join('')} = ${s}`);
            }
          }
        }
      }),
    ).toEqual([]);
  });

  it('Chance is always the dice sum; in Classic, 3 and 4 of a kind never beat it and agree with each other', () => {
    expect(
      failures((fail) => {
        for (const dice of allRolls()) {
          if (rawScore(CLASSIC, 'chance', dice) !== sum(dice)) fail(`chance ${dice.join('')}`);
          if (rawScore(CLASSIC, 'threeKind', dice) > sum(dice)) fail(`threeKind ${dice.join('')}`);
          const four = rawScore(CLASSIC, 'fourKind', dice);
          if (four > 0 && four !== rawScore(CLASSIC, 'threeKind', dice)) fail(`fourKind ${dice.join('')}`);
        }
      }),
    ).toEqual([]);
  });

  it('a Classic large straight is always also a small straight; Scandinavian straights are exclusive', () => {
    expect(
      failures((fail) => {
        for (const dice of allRolls()) {
          if (rawScore(CLASSIC, 'largeStraight', dice) > 0 && rawScore(CLASSIC, 'smallStraight', dice) !== 30) fail(`classic ${dice.join('')}`);
          const small = rawScore(SCANDINAVIAN, 'smallStraight', dice) > 0;
          const large = rawScore(SCANDINAVIAN, 'largeStraight', dice) > 0;
          if (small && large) fail(`scandi ${dice.join('')}`);
        }
      }),
    ).toEqual([]);
  });

  it('a Yatzy scores every "of a kind" box, and exactly 6 rolls are Yatzys', () => {
    let yatzys = 0;
    for (const dice of allRolls()) {
      if (rawScore(CLASSIC, 'yatzy', dice) !== 50) continue;
      yatzys++;
      expect(rawScore(CLASSIC, 'threeKind', dice)).toBe(sum(dice));
      expect(rawScore(CLASSIC, 'fourKind', dice)).toBe(sum(dice));
      expect(rawScore(SCANDINAVIAN, 'onePair', dice)).toBe(dice[0] * 2);
      expect(rawScore(SCANDINAVIAN, 'threeKind', dice)).toBe(dice[0] * 3);
      expect(rawScore(SCANDINAVIAN, 'fourKind', dice)).toBe(dice[0] * 4);
      // Five of a kind is not a full house (3 + 2 of different faces) in either preset.
      expect(rawScore(CLASSIC, 'fullHouse', dice)).toBe(0);
      expect(rawScore(SCANDINAVIAN, 'fullHouse', dice)).toBe(0);
      // Nor two pairs: that needs two different faces.
      expect(rawScore(SCANDINAVIAN, 'twoPairs', dice)).toBe(0);
    }
    expect(yatzys).toBe(6);
  });

  it('counts how many rolls make each special hand (sanity against known probabilities)', () => {
    const count = (preset: RulePreset, box: BoxId) => {
      let n = 0;
      for (const dice of allRolls()) if (rawScore(preset, box, dice) > 0) n++;
      return n;
    };
    // Known one-roll frequencies out of 7776.
    expect(count(CLASSIC, 'fullHouse')).toBe(300);
    expect(count(CLASSIC, 'largeStraight')).toBe(240);
    expect(count(CLASSIC, 'smallStraight')).toBe(1200);
    expect(count(CLASSIC, 'fourKind')).toBe(156);
    expect(count(CLASSIC, 'threeKind')).toBe(1656);
    expect(count(SCANDINAVIAN, 'smallStraight')).toBe(120);
    expect(count(SCANDINAVIAN, 'largeStraight')).toBe(120);
    expect(count(SCANDINAVIAN, 'twoPairs')).toBe(2100);
  });
});

describe('joker rule in depth (Classic, specs.md §4.2)', () => {
  const yatzyOf = (f: Face): Face[] => [f, f, f, f, f];

  it('for every face: the matching upper box is forced while open', () => {
    for (const f of FACES) {
      const card: Scorecard = { yatzy: 50 };
      expect(allowedBoxes(CLASSIC, card, yatzyOf(f), false)).toEqual([UPPER_BOXES[f - 1]]);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), UPPER_BOXES[f - 1])).toBe(f * 5);
      expect(extraYatzyBonusFor(CLASSIC, card, yatzyOf(f))).toBe(100);
    }
  });

  it('for every face: once the upper box is used, any open lower box takes full value', () => {
    for (const f of FACES) {
      const card: Scorecard = { yatzy: 50, [UPPER_BOXES[f - 1]]: 0 };
      const allowed = allowedBoxes(CLASSIC, card, yatzyOf(f), false);
      expect(allowed.every((b) => !isUpperBox(b))).toBe(true);
      expect(allowed).toEqual(['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'chance']);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'fullHouse')).toBe(25);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'smallStraight')).toBe(30);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'largeStraight')).toBe(40);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'threeKind')).toBe(f * 5);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'fourKind')).toBe(f * 5);
      expect(scoreFor(CLASSIC, card, yatzyOf(f), 'chance')).toBe(f * 5);
    }
  });

  it('a Yatzy scored as 0 in the Yatzy box does not turn on the joker later', () => {
    const card: Scorecard = { yatzy: 0 };
    expect(isJokerActive(CLASSIC, card, yatzyOf(3))).toBe(false);
    expect(allowedBoxes(CLASSIC, card, yatzyOf(3), false)).toEqual(openBoxes(CLASSIC, card));
    // Without the joker, a Yatzy does not fill the straights or full house.
    expect(scoreFor(CLASSIC, card, yatzyOf(3), 'fullHouse')).toBe(0);
    expect(scoreFor(CLASSIC, card, yatzyOf(3), 'largeStraight')).toBe(0);
    expect(extraYatzyBonusFor(CLASSIC, card, yatzyOf(3))).toBe(0);
  });

  it('a non-Yatzy roll while the Yatzy box holds 50 is scored normally', () => {
    const card: Scorecard = { yatzy: 50 };
    const dice: Face[] = [2, 2, 2, 2, 3];
    expect(isJokerActive(CLASSIC, card, dice)).toBe(false);
    expect(allowedBoxes(CLASSIC, card, dice, false)).toHaveLength(12);
    expect(scoreFor(CLASSIC, card, dice, 'fullHouse')).toBe(0);
  });

  it('the joker never applies in Scandinavian, where extra Yatzys earn nothing', () => {
    const card: Scorecard = { yatzy: 50 };
    expect(allowedBoxes(SCANDINAVIAN, card, yatzyOf(4), false)).toEqual(openBoxes(SCANDINAVIAN, card));
    expect(scoreFor(SCANDINAVIAN, card, yatzyOf(4), 'smallStraight')).toBe(0);
    expect(scoreFor(SCANDINAVIAN, card, yatzyOf(4), 'fullHouse')).toBe(0);
    expect(extraYatzyBonusFor(SCANDINAVIAN, card, yatzyOf(4))).toBe(0);
  });

  it('with the whole lower section full, the joker Yatzy goes in an open upper box for 0', () => {
    const card: Scorecard = { yatzy: 50, sixes: 30, threeKind: 1, fourKind: 1, fullHouse: 25, smallStraight: 30, largeStraight: 40, chance: 1 };
    expect(allowedBoxes(CLASSIC, card, yatzyOf(6), false)).toEqual(['ones', 'twos', 'threes', 'fours', 'fives']);
    for (const box of ['ones', 'twos', 'threes', 'fours', 'fives'] as const) expect(scoreFor(CLASSIC, card, yatzyOf(6), box)).toBe(0);
    // The bonus is still earned even though the roll scores 0 points.
    expect(extraYatzyBonusFor(CLASSIC, card, yatzyOf(6))).toBe(100);
  });

  it('potentialScores agrees with allowedBoxes and scoreFor in every joker situation', () => {
    const cards: Scorecard[] = [{ yatzy: 50 }, { yatzy: 50, fives: 15 }, { yatzy: 50, fives: 15, chance: 10 }, { yatzy: 0 }, {}];
    for (const card of cards) {
      for (const f of FACES) {
        const dice = yatzyOf(f);
        const hints = potentialScores(CLASSIC, card, dice, false);
        expect(Object.keys(hints)).toEqual(allowedBoxes(CLASSIC, card, dice, false));
        for (const [box, pts] of Object.entries(hints)) expect(pts).toBe(scoreFor(CLASSIC, card, dice, box as BoxId));
      }
    }
  });
});

describe('forced order in depth', () => {
  it('walks the pad in exactly preset order for both presets', () => {
    for (const preset of [CLASSIC, SCANDINAVIAN]) {
      const card: Scorecard = {};
      for (const expected of preset.boxes) {
        expect(allowedBoxes(preset, card, [1, 2, 3, 4, 5], true)).toEqual([expected]);
        card[expected] = 0;
      }
      expect(allowedBoxes(preset, card, [1, 2, 3, 4, 5], true)).toEqual([]);
    }
  });

  it('skips boxes that are already filled out of order (a free-order game cannot become forced mid-way, but the rule is robust)', () => {
    const card: Scorecard = { ones: 1, twos: 2, fours: 4 };
    expect(allowedBoxes(CLASSIC, card, [1, 2, 3, 4, 5], true)).toEqual(['threes']);
  });
});

describe('totals in depth', () => {
  const fullUpper = (perFace: number): Scorecard =>
    Object.fromEntries(UPPER_BOXES.map((b, i) => [b, (i + 1) * perFace])) as Scorecard;

  it('three of each face is exactly the 63 threshold in both presets', () => {
    expect(totals(CLASSIC, fullUpper(3), 0)).toMatchObject({ upper: 63, upperBonus: 35 });
    expect(totals(SCANDINAVIAN, fullUpper(3), 0)).toMatchObject({ upper: 63, upperBonus: 50 });
  });

  it('one pip short of the threshold earns nothing, one over earns the full bonus', () => {
    const short: Scorecard = { ...fullUpper(3), ones: 2 };
    const over: Scorecard = { ...fullUpper(3), ones: 4 };
    expect(totals(CLASSIC, short, 0).upperBonus).toBe(0);
    expect(totals(CLASSIC, over, 0).upperBonus).toBe(35);
  });

  it('the maximum Classic card totals 375 + 35 bonus with no extra Yatzys', () => {
    const max: Scorecard = {
      ...fullUpper(5),
      threeKind: 30,
      fourKind: 30,
      fullHouse: 25,
      smallStraight: 30,
      largeStraight: 40,
      yatzy: 50,
      chance: 30,
    };
    expect(totals(CLASSIC, max, 0).total).toBe(105 + 35 + 235);
  });

  it('ignores boxes that are not in the preset and treats missing boxes as 0', () => {
    const card: Scorecard = { onePair: 12, sixes: 18 };
    expect(totals(CLASSIC, card, 0)).toEqual({ upper: 18, upperBonus: 0, lower: 0, extraYatzyBonus: 0, total: 18 });
    expect(totals(SCANDINAVIAN, card, 0).lower).toBe(12);
  });

  it('extra Yatzy bonus scales with the count and the preset', () => {
    for (let n = 0; n <= 12; n++) {
      expect(totals(CLASSIC, {}, n).extraYatzyBonus).toBe(100 * n);
      expect(totals(SCANDINAVIAN, {}, n).extraYatzyBonus).toBe(0);
    }
  });
});
