import type { Repository } from '../data/repository';
import type { RootData } from '../data/schema';

let repository: Repository | null = null;
let data: RootData | null = null;
let readOnly = false;

/**
 * Loads the root blob once at startup. The app passes the MMKV repository;
 * tests pass one backed by an in-memory map.
 */
export function initAppData(repo: Repository): RootData {
  const result = repo.load();
  repository = repo;
  data = result.data;
  readOnly = result.readOnly;
  return data;
}

export function getAppData(): RootData {
  if (!data) throw new Error('initAppData() must run before the stores are used');
  return data;
}

/** True when the saved data could not be read; nothing is written so it is never lost. */
export function isReadOnly(): boolean {
  return readOnly;
}

/** Applies `change` and writes the whole blob synchronously (MMKV), so a kill never loses it. */
export function updateAppData(change: (current: RootData) => RootData): RootData {
  const next = change(getAppData());
  data = next;
  repository?.save(next);
  return next;
}
