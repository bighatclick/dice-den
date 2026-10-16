import { Repository, type KeyValueStore } from '../data/repository';
import type { Face } from '../engine/dice';
import type { Rng } from '../engine/rng';
import { initAppData } from '../state/appData';
import { setGameRng } from '../state/rng';

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getString: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
}

/** Fresh in-memory app data; returns the store so tests can "relaunch" from it. */
export function setUpAppData(store = memoryStore()) {
  initAppData(new Repository(store));
  return store;
}

/** Plays back `faces` in order, then repeats them. */
export function scriptedRng(faces: Face[]): Rng {
  let i = 0;
  return { nextFace: () => faces[i++ % faces.length] };
}

export function scriptDice(faces: Face[]): void {
  setGameRng(scriptedRng(faces));
}
