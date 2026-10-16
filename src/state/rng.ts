import { getRandomBytes } from 'expo-crypto';
import { createCryptoRng, type Rng } from '../engine/rng';

let rng: Rng | null = null;

/** The one crypto RNG every player and every AI rolls with (CLAUDE.md rule 2). */
export function getGameRng(): Rng {
  if (!rng) rng = createCryptoRng(getRandomBytes);
  return rng;
}

/** Tests only: swap in a scripted RNG. */
export function setGameRng(next: Rng | null): void {
  rng = next;
}
