import { DEFAULT_ADS, DEFAULT_SETTINGS } from '../schema';
import type { Migration } from './types';

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v1 → v2: adds the cosmetics and motion settings, daily.reminderAsked and the
 * `ads` block. Everything already saved is kept exactly as it was.
 */
export const migration002CosmeticsAndAds: Migration = {
  from: 1,
  to: 2,
  name: '002-cosmetics-and-ads',
  migrate(input) {
    if (!isRecord(input)) throw new Error('v1 data is not an object');
    const settings = isRecord(input.settings) ? input.settings : {};
    const daily = isRecord(input.daily) ? input.daily : {};
    return {
      ...input,
      schemaVersion: 2,
      settings: {
        ...settings,
        reduceMotion: settings.reduceMotion ?? DEFAULT_SETTINGS.reduceMotion,
        aiSpeed: settings.aiSpeed ?? DEFAULT_SETTINGS.aiSpeed,
        diceSkin: settings.diceSkin ?? DEFAULT_SETTINGS.diceSkin,
        table: settings.table ?? DEFAULT_SETTINGS.table,
      },
      daily: { ...daily, reminderAsked: daily.reminderAsked ?? false },
      ads: isRecord(input.ads)
        ? input.ads
        : { ...DEFAULT_ADS, rewarded: { ...DEFAULT_ADS.rewarded }, reviewPrompts: [], trials: {} },
    };
  },
};
