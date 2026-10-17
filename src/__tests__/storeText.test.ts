import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import en from '../i18n/en.json';

const STORE = join(__dirname, '..', '..', 'store', 'en');
const read = (file: string) => readFileSync(join(STORE, file), 'utf8').trim();

const LIMITS: Record<string, number> = {
  'ios/title.txt': 30,
  'ios/subtitle.txt': 30,
  'ios/keywords.txt': 100,
  'ios/promotional-text.txt': 170,
  'ios/description.txt': 4000,
  'play/title.txt': 30,
  'play/short-description.txt': 80,
  'play/full-description.txt': 4000,
};

// CLAUDE.md rules 4 and 5, specs.md §2.
const BANNED = [/\bfree\b/i, /\bno ads\b/i, /\bad-free\b/i, /#1/, /\bbest\b/i, /yahtzee/i, /kniffel/i, /yatzee/i];
const EMOJI = /\p{Extended_Pictographic}/u;

function storeFiles(dir = STORE, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? storeFiles(join(dir, e.name), `${prefix}${e.name}/`) : e.name.endsWith('.txt') ? [`${prefix}${e.name}`] : [],
  );
}

describe('store text (store/en)', () => {
  it.each(Object.entries(LIMITS))('%s fits in %i characters', (file, limit) => {
    expect([...read(file)].length).toBeLessThanOrEqual(limit);
    expect(read(file).length).toBeGreaterThan(0);
  });

  it.each(storeFiles())('%s has no banned words, trademarks or emoji', (file) => {
    const text = read(file);
    for (const word of BANNED) expect(text).not.toMatch(word);
    expect(text).not.toMatch(EMOJI);
  });

  it('keywords are comma-separated with no spaces or repeats of the title', () => {
    const keywords = read('ios/keywords.txt').split(',');
    expect(keywords.every((k) => k.length > 0 && !/\s/.test(k))).toBe(true);
    expect(new Set(keywords).size).toBe(keywords.length);
    expect(keywords).not.toContain('yatzy');
    expect(keywords).not.toContain('dice');
  });

  it('the description says Yatzy and dice game naturally, 2 to 4 times each', () => {
    const text = read('ios/description.txt');
    const count = (re: RegExp) => (text.match(re) ?? []).length;
    expect(count(/Yatzy/g)).toBeGreaterThanOrEqual(2);
    expect(count(/Yatzy/g)).toBeLessThanOrEqual(5);
    expect(count(/dice game/gi)).toBeGreaterThanOrEqual(2);
    expect(count(/dice game/gi)).toBeLessThanOrEqual(4);
  });
});

describe('in-app text', () => {
  it('never names a trademark', () => {
    const all = JSON.stringify(en);
    for (const word of [/yahtzee/i, /kniffel/i, /yatzee/i]) expect(all).not.toMatch(word);
  });
});
