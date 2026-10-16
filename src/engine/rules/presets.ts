export type UpperBoxId = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes';
export type LowerBoxId =
  | 'onePair'
  | 'twoPairs'
  | 'threeKind'
  | 'fourKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yatzy'
  | 'chance';
export type BoxId = UpperBoxId | LowerBoxId;

export type PresetId = 'classic' | 'scandinavian';

export interface RulePreset {
  id: PresetId;
  /** Score pad order; forced-order games fill boxes in exactly this order. */
  boxes: readonly BoxId[];
  upperBonusThreshold: number;
  upperBonus: number;
  /** Bonus per extra Yatzy once the Yatzy box holds 50 (0 = no extra Yatzys). */
  extraYatzyBonus: number;
  /** Classic joker rule (specs.md §4.2). */
  joker: boolean;
}

export const UPPER_BOXES: readonly UpperBoxId[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

export function isUpperBox(box: BoxId): box is UpperBoxId {
  return (UPPER_BOXES as readonly BoxId[]).includes(box);
}

/** Face value an upper box counts (ones → 1 … sixes → 6). */
export function upperFace(box: UpperBoxId): number {
  return UPPER_BOXES.indexOf(box) + 1;
}

export const CLASSIC: RulePreset = {
  id: 'classic',
  boxes: [
    ...UPPER_BOXES,
    'threeKind',
    'fourKind',
    'fullHouse',
    'smallStraight',
    'largeStraight',
    'yatzy',
    'chance',
  ],
  upperBonusThreshold: 63,
  upperBonus: 35,
  extraYatzyBonus: 100,
  joker: true,
};

export const SCANDINAVIAN: RulePreset = {
  id: 'scandinavian',
  boxes: [
    ...UPPER_BOXES,
    'onePair',
    'twoPairs',
    'threeKind',
    'fourKind',
    'smallStraight',
    'largeStraight',
    'fullHouse',
    'chance',
    'yatzy',
  ],
  upperBonusThreshold: 63,
  upperBonus: 50,
  extraYatzyBonus: 0,
  joker: false,
};

export const PRESETS: Record<PresetId, RulePreset> = {
  classic: CLASSIC,
  scandinavian: SCANDINAVIAN,
};
