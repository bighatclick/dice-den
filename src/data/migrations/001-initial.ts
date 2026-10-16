import { createDefaultData, DEFAULT_SETTINGS } from '../schema';
import type { Migration } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * v0 → v1: v0 is any blob written before schemaVersion existed (pre-release builds).
 * Known settings are kept; everything else starts from the v1 defaults.
 */
export const migration001Initial: Migration = {
  from: 0,
  to: 1,
  name: '001-initial',
  migrate(input) {
    const data = createDefaultData();
    if (!isRecord(input)) return data;
    if (isRecord(input.settings)) {
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
        const value = input.settings[key];
        if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
          (data.settings as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }
    return data;
  },
};
