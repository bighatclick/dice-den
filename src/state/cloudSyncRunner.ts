import { AppState } from 'react-native';
import { cloudKv, type CloudKv } from '../../modules/cloud-kv';
import { getAppData, isReadOnly, updateAppData } from './appData';
import { CLOUD_KEY, mergeCloud, parsePayload, toPayload } from './cloudSync';
import { useSettingsStore } from './settingsStore';

/**
 * Pulls the iCloud copy, merges it into local data, then pushes the result.
 * Does nothing without iCloud (Android, signed out) or in read-only safe mode,
 * and never throws: sync must not block play.
 */
export function syncWithCloud(kv: CloudKv | null = cloudKv): boolean {
  try {
    if (!kv || !kv.isAvailable() || isReadOnly()) return false;
    const remote = parsePayload(kv.getString(CLOUD_KEY));
    if (remote) {
      updateAppData((local) => mergeCloud(local, remote));
      useSettingsStore.getState().hydrate();
    }
    kv.setString(CLOUD_KEY, JSON.stringify(toPayload(getAppData())));
    kv.synchronize();
    return true;
  } catch {
    return false;
  }
}

/** Syncs now, when another device changes the data, and when the app comes or goes. */
export function startCloudSync(kv: CloudKv | null = cloudKv): () => void {
  if (!kv) return () => {};
  syncWithCloud(kv);
  const offChange = kv.onChange((keys) => {
    if (keys.includes(CLOUD_KEY)) syncWithCloud(kv);
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active' || state === 'background') syncWithCloud(kv);
  });
  return () => {
    offChange();
    appState.remove();
  };
}
