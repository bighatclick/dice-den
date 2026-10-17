import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../data/schema';
import { getAppData, updateAppData } from './appData';

interface SettingsStore {
  settings: Settings;
  hydrate(): void;
  update(change: Partial<Settings>): void;
}

/** Reactive settings; every change is saved at once and stamped for the iCloud merge. */
export const useSettingsStore = create<SettingsStore>()((set) => ({
  settings: DEFAULT_SETTINGS,
  hydrate() {
    set({ settings: getAppData().settings });
  },
  update(change) {
    const data = updateAppData((d) => ({
      ...d,
      settings: { ...d.settings, ...change },
      syncMeta: { ...d.syncMeta, settingsUpdatedAt: new Date().toISOString() },
    }));
    set({ settings: data.settings });
  },
}));

export function useSettings(): Settings {
  return useSettingsStore((s) => s.settings);
}
