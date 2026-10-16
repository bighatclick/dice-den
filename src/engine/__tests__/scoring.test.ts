import type { Face } from '../dice';
import { CLASSIC, SCANDINAVIAN, type BoxId } from '../rules/presets';
import {
  allowedBoxes,
  extraYatzyBonusFor,
  isCardComplete,
  isJokerActive,
  openBoxes,
  potentialScores,
  rawScore,
  scoreFor,
  totals,
  type Scorecard,
} from '../scoring';

const d = (s: string) => s.split('').map(Number) as Face[];

describe('rawScore: Classic', () => {
  const cases: [BoxId, string, number][] = [
    ['ones', '11234', 2],
    ['twos', '22256', 6],
    ['threes', '12456', 0],
    ['fours', '44441', 16],
    ['fives', '55555', 25],
    ['sixes', '66612', 18],
    ['threeKind', '33345', 18],
    ['threeKind', '33445', 0],
    ['threeKind', '66665', 29],
    ['fourKind', '22225', 13],
    ['fourKind', '22235', 0],
    ['fourKind', '44444', 20],
    ['fullHouse', '22333', 25],
    ['fullHouse', '22334', 0],
    ['fullHouse', '33333', 0],
    ['smallStraight', '12346', 30],
    ['smallStraight', '23451', 30],
    ['smallStraight', '34566', 30],
    ['smallStraight', '12456', 0],
    ['largeStraight', '12345', 40],
    ['largeStraight', '65432', 40],
    ['largeStraight', '12346', 0],
    ['yatzy', '66666', 50],
    ['yatzy', '66665', 0],
    ['chance', '12366', 18],
  ];
  it.each(cases)('%s with %s scores %i', (box, dice, expected) => {
    expect(rawScore(CLASSIC, box, d(dice))).toBe(expected);
  });

  it('rejects boxes that are not in the preset', () => {
    expect(() => rawScore(CLASSIC, 'onePair', d('11234'))).toThrow(/not part of the classic preset/);
  });
});

describe('rawScore: Scandinavian', () => {
  const cases: [BoxId, string, number][] = [
    ['ones', '11111', 5],
    ['sixes', '61616', 18],
    ['onePair', '33456', 6],
    ['onePair', '33556', 10],
    ['onePair', '12345', 0],
    ['twoPairs', '33556', 16],
    ['twoPairs', '22333', 10],
    ['twoPairs', '33335', 0],
    ['twoPairs', '12345', 0],
    ['threeKind', '44412', 12],
    ['threeKind', '44111', 3],
    ['threeKind', '12345', 0],
    ['fourKind', '55556', 20],
    ['fourKind', '55566', 0],
    ['smallStraight', '54321', 15],
    ['smallStraight', '23456', 0],
    ['largeStraight', '23456', 20],
    ['largeStraight', '12345', 0],
    ['fullHouse', '22333', 13],
    ['fullHouse', '22233', 12],
    ['fullHouse', '22222', 0],
    ['chance', '66665', 29],
    ['yatzy', '11111', 50],
    ['yatzy', '11112', 0],
  ];
  it.each(cases)('%s with %s scores %i', (box, dice, expected) => {
    expect(rawScore(SCANDINAVIAN, box, d(dice))).toBe(expected);
  });
});

describe('joker rule (Classic)', () => {
  const withYatzy50: Scorecard = { yatzy: 50 };

  it('is active only for a Yatzy when the Yatzy box holds 50', () => {
    expect(isJokerActive(CLASSIC, withYatzy50, d('44444'))).toBe(true);
    expect(isJokerActive(CLASSIC, { yatzy: 0 }, d('44444'))).toBe(false);
    expect(isJokerActive(CLASSIC, {}, d('44444'))).toBe(false);
    expect(isJokerActive(CLASSIC, withYatzy50, d('44443'))).toBe(false);
    expect(isJokerActive(SCANDINAVIAN, withYatzy50, d('44444'))).toBe(false);
  });

  it('forces the matching upper box when it is open', () => {
    expect(allowedBoxes(CLASSIC, withYatzy50, d('44444'), false)).toEqual(['fours']);
  });

  it('allows any open lower box when the matching upper box is filled', () => {
    const card: Scorecard = { yatzy: 50, fours: 12, chance: 20 };
    expect(allowedBoxes(CLASSIC, card, d('44444'), false)).toEqual([
      'threeKind',
      'fourKind',
      'fullHouse',
      'smallStraight',
      'largeStraight',
    ]);
  });

  it('falls back to any open upper box when the lower section is full', () => {
    const card: Scorecard = {
      yatzy: 50, fours: 12, threeKind: 20, fourKind: 20, fullHouse: 25, smallStraight: 30, largeStraight: 40, chance: 20,
    };
    expect(allowedBoxes(CLASSIC, card, d('44444'), false)).toEqual(['ones', 'twos', 'threes', 'fives', 'sixes']);
    expect(scoreFor(CLASSIC, card, d('44444'), 'ones')).toBe(0);
  });

  it('scores Full House and straights at full value', () => {
    const card: Scorecard = { yatzy: 50, fours: 12 };
    expect(scoreFor(CLASSIC, card, d('44444'), 'fullHouse')).toBe(25);
    expect(scoreFor(CLASSIC, card, d('44444'), 'smallStraight')).toBe(30);
    expect(scoreFor(CLASSIC, card, d('44444'), 'largeStraight')).toBe(40);
    expect(scoreFor(CLASSIC, card, d('44444'), 'threeKind')).toBe(20);
  });

  it('awards the extra Yatzy bonus only while the joker is active', () => {
    expect(extraYatzyBonusFor(CLASSIC, withYatzy50, d('22222'))).toBe(100);
    expect(extraYatzyBonusFor(CLASSIC, { yatzy: 0 }, d('22222'))).toBe(0);
    expect(extraYatzyBonusFor(SCANDINAVIAN, withYatzy50, d('22222'))).toBe(0);
  });
});

describe('box availability', () => {
  it('lists open boxes in pad order', () => {
    expect(openBoxes(CLASSIC, { ones: 3, chance: 20 })).toHaveLength(11);
    expect(openBoxes(SCANDINAVIAN, {})).toHaveLength(15);
  });

  it('forced order only allows the next open box, even for a joker', () => {
    expect(allowedBoxes(CLASSIC, { ones: 2 }, d('12345'), true)).toEqual(['twos']);
    expect(allowedBoxes(CLASSIC, { ones: 2, yatzy: 50 }, d('44444'), true)).toEqual(['twos']);
  });

  it('detects a complete card', () => {
    const full = Object.fromEntries(CLASSIC.boxes.map((b) => [b, 0])) as Scorecard;
    expect(isCardComplete(CLASSIC, full)).toBe(true);
    expect(isCardComplete(CLASSIC, {})).toBe(false);
  });

  it('gives hint values for every allowed box', () => {
    expect(potentialScores(CLASSIC, {}, d('55525'), false)).toMatchObject({
      fives: 20, twos: 2, threeKind: 22, fourKind: 22, fullHouse: 0, chance: 22, yatzy: 0,
    });
    expect(Object.keys(potentialScores(CLASSIC, {}, d('55525'), true))).toEqual(['ones']);
  });
});

describe('totals and the upper bonus', () => {
  it.each([
    [CLASSIC, 62, 0],
    [CLASSIC, 63, 35],
    [SCANDINAVIAN, 62, 0],
    [SCANDINAVIAN, 63, 50],
  ])('%#: upper sum %i gives bonus %i', (preset, upperSum, bonus) => {
    // sixes 24 + fives 20 + fours 16 = 60; threes adds the remainder.
    const card: Scorecard = { sixes: 24, fives: 20, fours: 16, threes: upperSum - 60 };
    expect(totals(preset, card, 0).upperBonus).toBe(bonus);
  });

  it('adds lower boxes and extra Yatzy bonuses', () => {
    const card: Scorecard = { ones: 3, yatzy: 50, chance: 22 };
    expect(totals(CLASSIC, card, 2)).toEqual({
      upper: 3, upperBonus: 0, lower: 72, extraYatzyBonus: 200, total: 275,
    });
  });
});
