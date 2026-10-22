import { randomBytes } from 'crypto';
import type { Face } from '../dice';
import { BYTE_LIMIT, createCryptoRng, createDailyRng, createSeededRng, hashSeed, sfc32, toDateKey, U32_LIMIT, type Rng } from '../rng';

const draw = (rng: Rng, n: number): Face[] => Array.from({ length: n }, () => rng.nextFace());

describe('hashSeed and sfc32 (the daily dice generator)', () => {
  it('hashes deterministically into four unsigned 32-bit words', () => {
    const a = hashSeed('2026-10-17|dice-den/daily/v1');
    const b = hashSeed('2026-10-17|dice-den/daily/v1');
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    for (const w of a) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('a one-character change in the seed changes the hash and the dice', () => {
    expect(hashSeed('a')).not.toEqual(hashSeed('b'));
    expect(hashSeed('')).not.toEqual(hashSeed(' '));
    expect(draw(createSeededRng('seed-1'), 30)).not.toEqual(draw(createSeededRng('seed-2'), 30));
  });

  it('sfc32 is deterministic for a seed and produces unsigned 32-bit integers', () => {
    const seed: [number, number, number, number] = [1, 2, 3, 4];
    const x = sfc32(seed);
    const y = sfc32([...seed] as typeof seed);
    for (let i = 0; i < 1000; i++) {
      const v = x();
      expect(v).toBe(y());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('does not share state between two generators from the same seed', () => {
    const a = createSeededRng('shared');
    const b = createSeededRng('shared');
    const first = draw(a, 10);
    expect(draw(b, 10)).toEqual(first);
    // Advancing one does not advance the other.
    draw(a, 5);
    expect(draw(b, 5)).toEqual(draw(createSeededRng('shared'), 15).slice(10));
  });
});

describe('the daily seed', () => {
  it('is salted: the raw date string gives a different sequence than the daily key', () => {
    expect(draw(createDailyRng('2026-10-17'), 20)).not.toEqual(draw(createSeededRng('2026-10-17'), 20));
  });

  it.each(['2026-1-7', '2026-10-7', '20261017', '2026/10/17', '2026-10-17T00:00', ' 2026-10-17', ''])('rejects %p', (key) => {
    expect(() => createDailyRng(key)).toThrow(/Invalid daily date key/);
  });

  it('accepts every real date in a year and never repeats a day-one sequence across the year', () => {
    const seen = new Map<string, string>();
    for (let d = new Date(Date.UTC(2026, 0, 1)); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const seq = draw(createDailyRng(key), 25).join('');
      expect(seen.has(seq)).toBe(false);
      seen.set(seq, key);
    }
    expect(seen.size).toBe(365);
  });

  it('a full 13-turn game (65 dice at most 195 draws) is identical on two "devices"', () => {
    const a = createDailyRng('2026-12-25');
    const b = createDailyRng('2026-12-25');
    expect(draw(a, 195)).toEqual(draw(b, 195));
  });
});

describe('the crypto RNG byte mapping', () => {
  it('every accepted byte maps to a face with exactly 42 bytes per face', () => {
    const perFace = [0, 0, 0, 0, 0, 0];
    const rng = createCryptoRng(() => Uint8Array.from({ length: 256 }, (_, i) => i), 256);
    for (let i = 0; i < BYTE_LIMIT; i++) perFace[rng.nextFace() - 1]++;
    expect(perFace).toEqual([42, 42, 42, 42, 42, 42]);
  });

  it('asks the byte source again only once a batch is used up, and survives an all-rejected batch', () => {
    const batches = [new Uint8Array([255, 255, 255, 255]), new Uint8Array([252, 253, 254, 255]), new Uint8Array([0, 1, 2, 3])];
    const source = jest.fn((n: number) => {
      expect(n).toBe(4);
      return batches.shift()!;
    });
    const rng = createCryptoRng(source, 4);
    expect(draw(rng, 4)).toEqual([1, 2, 3, 4]);
    expect(source).toHaveBeenCalledTimes(3);
  });

  it('uses the default batch size of 64 bytes', () => {
    const source = jest.fn((n: number) => new Uint8Array(randomBytes(n)));
    const rng = createCryptoRng(source);
    draw(rng, 1);
    expect(source).toHaveBeenCalledWith(64);
  });

  it('U32 rejection limit is the largest multiple of 6 below 2^32', () => {
    expect(U32_LIMIT % 6).toBe(0);
    expect(U32_LIMIT + 6).toBeGreaterThan(0xffffffff);
  });

  it('is fair at the small-sample level too: no face is missing from 600 rolls', () => {
    const faces = new Set(draw(createCryptoRng((n) => new Uint8Array(randomBytes(n))), 600));
    expect(faces.size).toBe(6);
  });
});

describe('toDateKey', () => {
  it.each([
    [new Date(2026, 0, 1, 0, 0), '2026-01-01'],
    [new Date(2026, 11, 31, 23, 59, 59), '2026-12-31'],
    [new Date(2024, 1, 29, 12), '2024-02-29'],
    [new Date(2026, 9, 7, 1), '2026-10-07'],
  ])('%s → %s', (date, key) => {
    expect(toDateKey(date)).toBe(key);
  });

  it('is based on the local calendar day, not UTC', () => {
    // Just before midnight local time stays on the local date.
    const local = new Date(2026, 5, 15, 23, 30);
    expect(toDateKey(local)).toBe('2026-06-15');
  });
});
