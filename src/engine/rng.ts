import type { Face } from './dice';

/**
 * The only source of dice in the app. Every player and every AI draws from the
 * same Rng; nothing in the engine can bias it (see the fairness page).
 */
export interface Rng {
  nextFace(): Face;
}

/** Returns `count` cryptographically secure random bytes (expo-crypto in the app). */
export type ByteSource = (count: number) => Uint8Array;

/** 252 = 42 * 6: bytes at or above it are rejected so every face has exactly 42/252 odds. */
export const BYTE_LIMIT = 252;

export function faceFromByte(byte: number): Face | null {
  return byte < BYTE_LIMIT ? ((byte % 6) + 1) as Face : null;
}

export function createCryptoRng(randomBytes: ByteSource, batchSize = 64): Rng {
  let buffer: Uint8Array = new Uint8Array(0);
  let index = 0;
  return {
    nextFace() {
      for (;;) {
        if (index >= buffer.length) {
          buffer = randomBytes(batchSize);
          index = 0;
        }
        const face = faceFromByte(buffer[index++]);
        if (face !== null) return face;
      }
    },
  };
}

/** cyrb128: hashes a string into four 32-bit seeds for sfc32. */
export function hashSeed(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32 PRNG: returns unsigned 32-bit integers. */
export function sfc32(seed: [number, number, number, number]): () => number {
  let [a, b, c, d] = seed;
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}

/** floor(2^32 / 6) * 6: values at or above it are rejected (no modulo bias). */
export const U32_LIMIT = 4294967292;

export function createSeededRng(seed: string): Rng {
  const next = sfc32(hashSeed(seed));
  return {
    nextFace() {
      for (;;) {
        const value = next();
        if (value < U32_LIMIT) return ((value % 6) + 1) as Face;
      }
    },
  };
}

const DAILY_SALT = 'dice-den/daily/v1';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Everyone gets the same dice sequence for the same YYYY-MM-DD. */
export function createDailyRng(dateKey: string): Rng {
  if (!DATE_KEY.test(dateKey)) throw new Error(`Invalid daily date key: ${dateKey}`);
  return createSeededRng(`${dateKey}|${DAILY_SALT}`);
}

/** The player's local calendar date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
