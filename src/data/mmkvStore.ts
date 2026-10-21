import { createMMKV } from 'react-native-mmkv';
import { Repository, type KeyValueStore } from './repository';
import { reportError } from '../crash/crashReporting';

let repository: Repository | null = null;

/** App-wide repository backed by MMKV (stored in Application Support, so it is in device backups). */
export function getRepository(): Repository {
  if (!repository) {
    const mmkv = createMMKV({ id: 'dice-den' });
    const store: KeyValueStore = {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => mmkv.set(key, value),
    };
    // Safe mode keeps the old data untouched; the crash report says why (specs.md §5).
    repository = new Repository(store, { onError: reportError });
  }
  return repository;
}
