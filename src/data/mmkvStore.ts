import { createMMKV } from 'react-native-mmkv';
import { Repository, type KeyValueStore } from './repository';

let repository: Repository | null = null;

/** App-wide repository backed by MMKV (stored in Application Support, so it is in device backups). */
export function getRepository(): Repository {
  if (!repository) {
    const mmkv = createMMKV({ id: 'dice-den' });
    const store: KeyValueStore = {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => mmkv.set(key, value),
    };
    repository = new Repository(store);
  }
  return repository;
}
