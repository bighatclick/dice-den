/**
 * Dice skins and tables (specs.md §7.2). Cosmetic only: a skin never changes
 * the dice, the odds or the score. Ids are stored in settings and unlocks, so
 * never rename one.
 */

/** How a cosmetic is obtained. Packs map to product ids in src/iap/products.ts. */
export type CosmeticSource = 'start' | 'games10' | 'streak7' | 'classicPack' | 'tablePack';

export interface DiceSkin {
  id: string;
  source: CosmeticSource;
  /** Face gradient (top-left → bottom-right). Omitted on ivory, which follows the theme. */
  face?: readonly [string, string, string];
  edge?: string;
  /** Pip gradient: highlight, body, shadow. */
  pip?: readonly [string, string, string];
  /** The little pressed-in shine under each pip. */
  pipShine?: string;
  /** High-contrast pips are black on light faces and white on dark ones. */
  contrastPip: '#000000' | '#FFFFFF';
}

export interface TableStyle {
  id: string;
  source: CosmeticSource;
  /** Radial gradient: centre, middle, rim. Omitted on felt, which follows the theme. */
  colors?: readonly [string, string, string];
}

export const DICE_SKINS: readonly DiceSkin[] = [
  { id: 'ivory', source: 'start', contrastPip: '#000000' },
  {
    id: 'walnut',
    source: 'start',
    face: ['#A2643A', '#86492A', '#5C2D14'],
    edge: '#3E1C0B',
    pip: ['#FFFFFF', '#F6EAD7', '#D9C7AA'],
    pipShine: 'rgba(0,0,0,0.35)',
    contrastPip: '#FFFFFF',
  },
  {
    id: 'amber',
    source: 'games10',
    face: ['#F6C463', '#DD9128', '#B06A12'],
    edge: '#7C4708',
    pip: ['#6A3F0E', '#3A2003', '#1C0E00'],
    pipShine: 'rgba(255,240,200,0.7)',
    contrastPip: '#000000',
  },
  {
    id: 'jade',
    source: 'streak7',
    face: ['#6CC097', '#3E9268', '#246B47'],
    edge: '#174A30',
    pip: ['#FFFFFF', '#F2FBF6', '#CFE9DB'],
    pipShine: 'rgba(0,0,0,0.3)',
    contrastPip: '#FFFFFF',
  },
  {
    id: 'bone',
    source: 'classicPack',
    face: ['#F7EDD9', '#E6D5B5', '#CDB68E'],
    edge: '#A88E63',
    pip: ['#6B5640', '#3B2A1A', '#1E140B'],
    pipShine: 'rgba(255,255,255,0.8)',
    contrastPip: '#000000',
  },
  {
    id: 'casinoRed',
    source: 'classicPack',
    face: ['#DE5446', '#B3261E', '#7E1712'],
    edge: '#5E0F0B',
    pip: ['#FFFFFF', '#FFFFFF', '#E9D9D7'],
    pipShine: 'rgba(0,0,0,0.3)',
    contrastPip: '#FFFFFF',
  },
  {
    id: 'marble',
    source: 'classicPack',
    face: ['#FAFAF8', '#DCDDDB', '#B9BBBA'],
    edge: '#8E9190',
    pip: ['#45525C', '#1E2A33', '#0B1218'],
    pipShine: 'rgba(255,255,255,0.85)',
    contrastPip: '#000000',
  },
  {
    id: 'glass',
    source: 'classicPack',
    face: ['#DDF0F7', '#A9D3E6', '#7DB5CF'],
    edge: '#4E8CA8',
    pip: ['#2F5B70', '#0F3447', '#06202D'],
    pipShine: 'rgba(255,255,255,0.8)',
    contrastPip: '#000000',
  },
];

export const TABLES: readonly TableStyle[] = [
  { id: 'felt', source: 'start' },
  { id: 'walnut', source: 'tablePack', colors: ['#9A6238', '#6B3A1C', '#3F200C'] },
  { id: 'slate', source: 'tablePack', colors: ['#66737B', '#3F4A52', '#232A30'] },
  { id: 'night', source: 'tablePack', colors: ['#34447A', '#1B2547', '#0C1128'] },
  { id: 'oxblood', source: 'tablePack', colors: ['#9A3A40', '#6A1D24', '#3A0C11'] },
];

export const DEFAULT_SKIN = DICE_SKINS[0];
export const DEFAULT_TABLE = TABLES[0];

export function skinById(id: string): DiceSkin | undefined {
  return DICE_SKINS.find((s) => s.id === id);
}

export function tableById(id: string): TableStyle | undefined {
  return TABLES.find((t) => t.id === id);
}
