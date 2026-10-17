import { Repository, type KeyValueStore } from '../data/repository';
import type { Face } from '../engine/dice';
import type { Rng } from '../engine/rng';
import { initAppData, updateAppData } from '../state/appData';
import { setGameRng } from '../state/rng';
import { useSettingsStore } from '../state/settingsStore';

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getString: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
}

/**
 * Fresh in-memory app data; returns the store so tests can "relaunch" from it.
 * Onboarding is marked done unless a test asks for a first launch.
 */
export function setUpAppData(store = memoryStore(), { firstLaunch = false } = {}) {
  initAppData(new Repository(store));
  if (!firstLaunch) updateAppData((d) => ({ ...d, settings: { ...d.settings, onboardingDone: true } }));
  useSettingsStore.getState().hydrate();
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
