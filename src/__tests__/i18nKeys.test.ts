import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import i18n from '../i18n/i18n';
import en from '../i18n/en.json';
import { pseudoString } from '../i18n/pseudo';
import { CLASSIC, SCANDINAVIAN } from '../engine/rules/presets';
import { DICE_SKINS, TABLES } from '../ui/cosmetics';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') continue;
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

type Tree = { [key: string]: string | Tree };
function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : leafKeys(v, `${prefix}${k}.`)));
}

/** i18next plural keys: "a.b_one" and "a.b_other" both resolve "a.b". */
function hasKey(key: string): boolean {
  return i18n.exists(key) || i18n.exists(`${key}_other`);
}

const SOURCES = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))];

describe('every translation key used in code exists in en.json', () => {
  // Literal keys: t('a.b'), t("a.b"), t(`a.b`), i18n.t('a.b').
  const LITERAL = /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g;
  // Template keys with one variable at the end: t(`boxes.${box}`), t(`shop.skins.${s.id}`).
  const TEMPLATE = /\bt\(\s*`([a-zA-Z0-9_.]+)\$\{[^}]+\}`/g;

  const used = new Map<string, string>();
  const prefixes = new Map<string, string>();
  for (const file of SOURCES) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(LITERAL)) used.set(m[1], file);
    for (const m of text.matchAll(TEMPLATE)) prefixes.set(m[1], file);
  }

  it('finds a meaningful number of keys (the scan is not broken)', () => {
    expect(used.size).toBeGreaterThan(150);
    expect(prefixes.size).toBeGreaterThan(3);
  });

  it.each([...used.entries()])('%s (used in %s)', (key) => {
    expect(hasKey(key)).toBe(true);
  });

  it.each([...prefixes.entries()])('prefix %s has at least one entry (used in %s)', (prefix) => {
    const all = leafKeys(en as Tree);
    expect(all.some((k) => k.startsWith(prefix))).toBe(true);
  });

  it('every box of both presets, every skin and every table has a name', () => {
    for (const box of new Set([...CLASSIC.boxes, ...SCANDINAVIAN.boxes])) expect(hasKey(`boxes.${box}`)).toBe(true);
    for (const s of DICE_SKINS) expect(hasKey(`shop.skins.${s.id}`)).toBe(true);
    for (const t of TABLES) expect(hasKey(`shop.tableNames.${t.id}`)).toBe(true);
    for (const level of ['easy', 'normal', 'expert']) {
      expect(hasKey(`players.computer_${level}`)).toBe(true);
      expect(hasKey(`newGame.${level}`)).toBe(true);
    }
    for (const box of CLASSIC.boxes.filter((b) => !['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].includes(b))) expect(hasKey(`help.classic.${box}`)).toBe(true);
    for (const box of SCANDINAVIAN.boxes.filter((b) => !['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].includes(b))) expect(hasKey(`help.scandinavian.${box}`)).toBe(true);
    for (const msg of ['thanks', 'pending', 'failed', 'restored', 'nothingToRestore', 'restoreFailed']) expect(hasKey(`shop.${msg}`)).toBe(true);
  });
});

describe('en.json hygiene', () => {
  const keys = leafKeys(en as Tree);
  const values = keys.map((k) => [k, i18n.t(k) as string] as const);

  it('has no empty strings', () => {
    for (const [k, v] of values) expect([k, v.trim().length > 0]).toEqual([k, true]);
  });

  it('plural keys always come in _one/_other pairs', () => {
    for (const k of keys) {
      if (k.endsWith('_one')) expect(keys).toContain(k.replace(/_one$/, '_other'));
      if (k.endsWith('_other')) expect(keys).toContain(k.replace(/_other$/, '_one'));
    }
  });

  it('placeholders are well formed and never nested or unbalanced', () => {
    for (const [k, v] of values) {
      expect([k, (v.match(/\{\{/g) ?? []).length]).toEqual([k, (v.match(/\}\}/g) ?? []).length]);
      for (const m of v.matchAll(/\{\{([^}]*)\}\}/g)) expect(m[1]).toMatch(/^\w+$/);
      expect(v.replace(/\{\{\w+\}\}/g, '')).not.toMatch(/[{}]/); // nothing but whole placeholders uses braces
    }
  });

  it('calls the 5-of-a-kind box "Yatzy" and never a trademark, and never hard-codes a price', () => {
    expect(i18n.t('boxes.yatzy')).toBe('Yatzy');
    const raw = JSON.stringify(en);
    expect(raw).not.toMatch(/yahtzee|kniffel|yatzee/i);
    expect(raw).not.toMatch(/\$\d|€\d|£\d|\d\.99/);
  });

  it('computer players are named "Computer (Level)" and never presented as a person', () => {
    expect(i18n.t('players.computer_easy')).toBe('Computer (Easy)');
    expect(i18n.t('players.computer_normal')).toBe('Computer (Normal)');
    expect(i18n.t('players.computer_expert')).toBe('Computer (Expert)');
  });

  it('store-banned words do not leak into the app either (so screenshots stay clean)', () => {
    const raw = JSON.stringify(en);
    expect(raw).not.toMatch(/\bad-free\b|#1|\bbest game\b/i);
    expect(raw).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('interpolation renders real values and plurals pick the right form', () => {
    expect(i18n.t('game.turnRoll', { turn: 3, roll: 2 })).toBe('Turn 3 · Roll 2 of 3');
    expect(i18n.t('daily.streak', { count: 1 })).toBe('1-day streak');
    expect(i18n.t('daily.streak', { count: 5 })).toBe('5-day streak');
    expect(i18n.t('final.yatzys', { count: 1 })).toBe('1 Yatzy');
    expect(i18n.t('final.yatzys', { count: 3 })).toBe('3 Yatzys');
    expect(i18n.t('stats.rolls', { count: 1 })).toBe('1 roll');
    expect(i18n.t('shop.trialsLeft', { count: 2 })).toBe('2 ads to watch today');
    expect(i18n.t('pad.extraYatzys', { count: 1 })).toBe('Extra Yatzy');
    expect(i18n.t('pad.extraYatzys', { count: 2 })).toBe('2 extra Yatzys');
  });

  it('a missing key falls back to the key itself, never to an empty string', () => {
    expect(i18n.t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('pseudo-locale edge cases', () => {
  it('leaves digits, punctuation and non-Latin characters alone', () => {
    expect(pseudoString('123 · +35')).toBe('[123 · +35~~~~]');
    expect(pseudoString('日本')).toBe('[日本~]');
  });

  it('keeps several placeholders in order', () => {
    expect(pseudoString('{{a}} and {{b}}')).toMatch(/^\[\{\{a\}\} áñď \{\{b\}\}~+\]$/);
  });

  it('an empty string becomes an empty bracket pair', () => {
    expect(pseudoString('')).toBe('[]');
  });
});
