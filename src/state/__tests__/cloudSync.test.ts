import type { CloudKv } from '../../../modules/cloud-kv';
import { createDefaultData, type RootData } from '../../data/schema';
import { setUpAppData } from '../../testing/appData';
import { getAppData, updateAppData } from '../appData';
import { CLOUD_KEY, mergeCloud, parsePayload, toPayload } from '../cloudSync';
import { startCloudSync, syncWithCloud } from '../cloudSyncRunner';
import { recordSession } from '../session';
import { useSettingsStore } from '../settingsStore';

function data(change: (d: RootData) => RootData = (d) => d): RootData {
  return change(createDefaultData());
}

describe('payload', () => {
  it('carries only settings, stats summary, unlocks and the streak', () => {
    const local = data((d) => ({ ...d, inProgress: null, gameLog: [] }));
    expect(Object.keys(toPayload(local)).sort()).toEqual(['daily', 'settings', 'settingsUpdatedAt', 'stats', 'unlocks', 'v']);
    expect(toPayload(local).daily).not.toHaveProperty('reminderAsked');
  });

  it('rejects anything that is not a v1 payload', () => {
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload('not json')).toBeNull();
    expect(parsePayload('{"v":2}')).toBeNull();
    expect(parsePayload(JSON.stringify(toPayload(data())))).not.toBeNull();
  });
});

describe('mergeCloud (specs.md §8)', () => {
  it('takes the max of counters and the earliest first launch', () => {
    const local = data((d) => ({ ...d, stats: { sessions: 5, gamesCompleted: 9, firstLaunchAt: '2026-10-10T00:00:00Z' } }));
    const remote = toPayload(data((d) => ({ ...d, stats: { sessions: 8, gamesCompleted: 3, firstLaunchAt: '2026-10-01T00:00:00Z' } })));
    expect(mergeCloud(local, remote).stats).toEqual({ sessions: 8, gamesCompleted: 9, firstLaunchAt: '2026-10-01T00:00:00Z' });
  });

  it('unions unlocks', () => {
    const local = data((d) => ({ ...d, unlocks: { dice: ['ivory', 'bone'], tables: ['felt'] } }));
    const remote = toPayload(data((d) => ({ ...d, unlocks: { dice: ['ivory', 'marble'], tables: ['slate'] } })));
    expect(mergeCloud(local, remote).unlocks).toEqual({ dice: ['ivory', 'bone', 'marble'], tables: ['felt', 'slate'] });
  });

  it('keeps whichever settings changed last', () => {
    const local = data((d) => ({ ...d, settings: { ...d.settings, sound: false }, syncMeta: { settingsUpdatedAt: '2026-10-16T10:00:00Z' } }));
    const newer = toPayload(data((d) => ({ ...d, settings: { ...d.settings, themeMode: 'dark' }, syncMeta: { settingsUpdatedAt: '2026-10-16T11:00:00Z' } })));
    const older = { ...newer, settingsUpdatedAt: '2026-10-16T09:00:00Z' };
    expect(mergeCloud(local, newer).settings).toMatchObject({ themeMode: 'dark', sound: true });
    expect(mergeCloud(local, newer).syncMeta.settingsUpdatedAt).toBe('2026-10-16T11:00:00Z');
    expect(mergeCloud(local, older).settings).toMatchObject({ themeMode: 'system', sound: false });
    expect(mergeCloud(local, { ...newer, settingsUpdatedAt: null }).settings.sound).toBe(false);
  });

  it('never makes a finished tutorial show again', () => {
    const local = data((d) => ({ ...d, settings: { ...d.settings, onboardingDone: true }, syncMeta: { settingsUpdatedAt: '2026-10-16T10:00:00Z' } }));
    const remote = toPayload(data((d) => ({ ...d, syncMeta: { settingsUpdatedAt: '2026-10-16T12:00:00Z' } })));
    expect(mergeCloud(local, remote).settings.onboardingDone).toBe(true);
  });

  it('unions daily results (local wins a clash) and takes the streak from the newer device', () => {
    const local = data((d) => ({
      ...d,
      daily: { ...d.daily, streak: 2, bestStreak: 4, lastCompleted: '2026-10-15', results: { '2026-10-14': 200, '2026-10-15': 210 } },
    }));
    const remote = toPayload(
      data((d) => ({
        ...d,
        daily: { ...d.daily, streak: 3, bestStreak: 3, lastCompleted: '2026-10-16', freezeUsedWeek: '2026-W42', results: { '2026-10-15': 999, '2026-10-16': 220 } },
      })),
    );
    expect(mergeCloud(local, remote).daily).toMatchObject({
      streak: 3,
      bestStreak: 4,
      lastCompleted: '2026-10-16',
      freezeUsedWeek: '2026-W42',
      results: { '2026-10-14': 200, '2026-10-15': 210, '2026-10-16': 220 },
    });
    // Same last day on both devices: the longer streak; older remote: local stays.
    expect(mergeCloud(local, { ...remote, daily: { ...remote.daily, lastCompleted: '2026-10-15', streak: 5 } }).daily.streak).toBe(5);
    expect(mergeCloud(local, { ...remote, daily: { ...remote.daily, lastCompleted: '2026-10-01', streak: 9 } }).daily.streak).toBe(2);
  });

  it('leaves the game log and the game in progress alone', () => {
    const local = data((d) => ({ ...d, gameLog: [] }));
    const merged = mergeCloud(local, toPayload(data()));
    expect(merged.gameLog).toBe(local.gameLog);
    expect(merged.inProgress).toBe(local.inProgress);
  });
});

function fakeKv(available = true): CloudKv & { store: Map<string, string>; fire: (keys: string[]) => void } {
  const store = new Map<string, string>();
  let listener: ((keys: string[]) => void) | null = null;
  return {
    store,
    fire: (keys) => listener?.(keys),
    isAvailable: () => available,
    getString: (k) => store.get(k) ?? null,
    setString: (k, v) => void store.set(k, v),
    synchronize: () => true,
    onChange(l) {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
}

describe('sync runner', () => {
  beforeEach(() => setUpAppData());

  it('pushes local data when iCloud is empty', () => {
    const kv = fakeKv();
    expect(syncWithCloud(kv)).toBe(true);
    expect(parsePayload(kv.store.get(CLOUD_KEY))?.settings.onboardingDone).toBe(true);
  });

  it('pulls, merges, saves and refreshes settings', () => {
    const kv = fakeKv();
    const remote = toPayload(data((d) => ({ ...d, settings: { ...d.settings, themeMode: 'dark' }, syncMeta: { settingsUpdatedAt: '2099-01-01T00:00:00Z' } })));
    kv.store.set(CLOUD_KEY, JSON.stringify(remote));
    syncWithCloud(kv);
    expect(getAppData().settings.themeMode).toBe('dark');
    expect(useSettingsStore.getState().settings.themeMode).toBe('dark');
  });

  it('does nothing without iCloud or without the module', () => {
    expect(syncWithCloud(fakeKv(false))).toBe(false);
    expect(syncWithCloud(null)).toBe(false);
    expect(startCloudSync(null)).toEqual(expect.any(Function));
  });

  it('re-syncs when another device changes the data', () => {
    const kv = fakeKv();
    const stop = startCloudSync(kv);
    kv.store.set(CLOUD_KEY, JSON.stringify(toPayload(data((d) => ({ ...d, unlocks: { dice: ['ivory', 'marble'], tables: ['felt'] } })))));
    kv.fire(['other-key']);
    expect(getAppData().unlocks.dice).not.toContain('marble');
    kv.fire([CLOUD_KEY]);
    expect(getAppData().unlocks.dice).toContain('marble');
    stop();
  });

  it('never throws, even if iCloud does', () => {
    const kv = { ...fakeKv(), getString: () => { throw new Error('iCloud down'); } };
    expect(syncWithCloud(kv)).toBe(false);
  });
});

describe('sessions', () => {
  it('counts cold starts and remembers the first launch', () => {
    setUpAppData();
    updateAppData((d) => ({ ...d, stats: { ...d.stats, firstLaunchAt: null } }));
    recordSession(new Date('2026-10-17T08:00:00Z'));
    recordSession(new Date('2026-10-18T08:00:00Z'));
    expect(getAppData().stats).toMatchObject({ sessions: 2, firstLaunchAt: '2026-10-17T08:00:00.000Z' });
  });
});
