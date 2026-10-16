import { randomBytes } from 'crypto';
import type { Face } from '../dice';
import {
  BYTE_LIMIT,
  createCryptoRng,
  createDailyRng,
  createSeededRng,
  faceFromByte,
  toDateKey,
  U32_LIMIT,
  type Rng,
} from '../rng';

const nodeBytes = (n: number) => new Uint8Array(randomBytes(n));

/** Chi-square critical value for 5 degrees of freedom at p = 0.01. */
const CHI2_CRITICAL_P01 = 15.086;

function chiSquare(rng: Rng, rolls: number): number {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < rolls; i++) counts[rng.nextFace() - 1]++;
  const expected = rolls / 6;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}

describe('crypto RNG', () => {
  it('maps bytes without modulo bias and rejects the top 4 values', () => {
    expect(BYTE_LIMIT % 6).toBe(0);
    expect(faceFromByte(0)).toBe(1);
    expect(faceFromByte(5)).toBe(6);
    expect(faceFromByte(251)).toBe(6);
    expect(faceFromByte(252)).toBeNull();
    expect(faceFromByte(255)).toBeNull();
  });

  it('skips rejected bytes and refills its buffer', () => {
    const batches = [new Uint8Array([255, 252, 0]), new Uint8Array([253, 7])];
    const source = jest.fn((_n: number) => batches.shift() ?? new Uint8Array([1]));
    const rng = createCryptoRng(source, 3);
    expect(rng.nextFace()).toBe(1);
    expect(rng.nextFace()).toBe(2);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('is uniform over 1M rolls (chi-square, p > 0.01)', () => {
    expect(chiSquare(createCryptoRng(nodeBytes, 4096), 1_000_000)).toBeLessThan(CHI2_CRITICAL_P01);
  });
});

describe('seeded and daily RNG', () => {
  const draw = (rng: Rng, n: number): Face[] => Array.from({ length: n }, () => rng.nextFace());

  it('gives the same sequence for the same date on every run', () => {
    expect(draw(createDailyRng('2026-10-16'), 200)).toEqual(draw(createDailyRng('2026-10-16'), 200));
  });

  it('gives different sequences on different dates', () => {
    expect(draw(createDailyRng('2026-10-16'), 50)).not.toEqual(draw(createDailyRng('2026-10-17'), 50));
  });

  it('pins the 2026-10-16 sequence so RNG changes are deliberate', () => {
    expect(draw(createDailyRng('2026-10-16'), 15)).toMatchSnapshot();
  });

  it('rejects malformed date keys', () => {
    expect(() => createDailyRng('16/10/2026')).toThrow(/Invalid daily date key/);
  });

  it('is uniform over 1M rolls (chi-square, p > 0.01)', () => {
    expect(U32_LIMIT % 6).toBe(0);
    expect(chiSquare(createSeededRng('uniformity'), 1_000_000)).toBeLessThan(CHI2_CRITICAL_P01);
  });

  it('formats the local date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
