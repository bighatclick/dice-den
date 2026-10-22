import { AppState, type AppStateStatus } from 'react-native';
import type { CloudKv } from '../../../modules/cloud-kv';
import { createDefaultData, type RootData } from '../../data/schema';
import { memoryStore, setUpAppData } from '../../testing/appData';
import { getAppData, initAppData, updateAppData } from '../appData';
import { CLOUD_KEY, mergeCloud, parsePayload, toPayload, type CloudPayload } from '../cloudSync';
import { startCloudSync, syncWithCloud } from '../cloudSyncRunner';
import { Repository } from '../../data/repository';

const data = (change: (d: RootData) => RootData = (d) => d): RootData => change(createDefaultData());

describe('merge properties (specs.md §8)', () => {
  const local = data((d) => ({
    ...d,
    stats: { sessions: 5, gamesCompleted: 9, firstLaunchAt: '2026-10-10T00:00:00Z' },
    unlocks: { dice: ['ivory', 'walnut', 'amber'], tables: ['felt'] },
    daily: { ...d.daily, streak: 2, bestStreak: 4, lastCompleted: '2026-10-15', results: { '2026-10-14': 200, '2026-10-15': 210 } },
    settings: { ...d.settings, sound: false },
    syncMeta: { settingsUpdatedAt: '2026-10-16T10:00:00Z' },
  }));
  const remote = toPayload(
    data((d) => ({
      ...d,
      stats: { sessions: 8, gamesCompleted: 3, firstLaunchAt: '2026-10-01T00:00:00Z' },
      unlocks: { dice: ['ivory', 'jade'], tables: ['felt', 'slate'] },
      daily: { ...d.daily, streak: 3, bestStreak: 3, lastCompleted: '2026-10-16', results: { '2026-10-16': 220 } },
      settings: { ...d.settings, themeMode: 'dark' },
      syncMeta: { settingsUpdatedAt: '2026-10-16T11:00:00Z' },
    })),
  );

  it('is idempotent: merging the same remote twice changes nothing more', () => {
    const once = mergeCloud(local, remote);
    const twice = mergeCloud(once, remote);
    expect(twice).toEqual(once);
  });

  it('merging a device with itself is the identity', () => {
    expect(mergeCloud(local, toPayload(local))).toEqual(local);
  });

  it('counters, unlocks and bestStreak are commutative (same result from either device)', () => {
    const remoteAsLocal = data((d) => ({ ...d, stats: remote.stats, unlocks: remote.unlocks, daily: { ...d.daily, ...remote.daily }, settings: remote.settings, syncMeta: { settingsUpdatedAt: remote.settingsUpdatedAt } }));
    const a = mergeCloud(local, remote);
    const b = mergeCloud(remoteAsLocal, toPayload(local));
    expect(a.stats).toEqual(b.stats);
    expect([...a.unlocks.dice].sort()).toEqual([...b.unlocks.dice].sort());
    expect([...a.unlocks.tables].sort()).toEqual([...b.unlocks.tables].sort());
    expect(a.daily.bestStreak).toBe(b.daily.bestStreak);
    expect(a.daily.lastCompleted).toBe(b.daily.lastCompleted);
    expect(a.settings.themeMode).toBe(b.settings.themeMode); // newest settings win from either side
    expect(a.syncMeta).toEqual(b.syncMeta);
  });

  it('never removes an unlock or lowers a counter, whatever the remote says', () => {
    const empty = toPayload(data());
    const merged = mergeCloud(local, empty);
    expect(merged.stats).toEqual(local.stats);
    expect(merged.unlocks).toEqual(local.unlocks);
    expect(merged.daily.results).toEqual(local.daily.results);
    expect(merged.daily.bestStreak).toBe(4);
  });

  it('keeps reminderAsked and purchases local (they are not in the payload)', () => {
    const withFlags = { ...local, daily: { ...local.daily, reminderAsked: true }, purchasesCache: { productIds: ['x'], updatedAt: null } };
    const merged = mergeCloud(withFlags, remote);
    expect(merged.daily.reminderAsked).toBe(true);
    expect(merged.purchasesCache).toEqual(withFlags.purchasesCache);
    expect(merged.ads).toBe(withFlags.ads);
  });

  it('a remote with settings but no timestamp never overrides local settings', () => {
    const merged = mergeCloud(local, { ...remote, settingsUpdatedAt: null });
    expect(merged.settings.themeMode).toBe('system');
    expect(merged.settings.sound).toBe(false);
    expect(merged.syncMeta.settingsUpdatedAt).toBe(local.syncMeta.settingsUpdatedAt);
  });

  it('equal timestamps keep the local settings', () => {
    const merged = mergeCloud(local, { ...remote, settingsUpdatedAt: local.syncMeta.settingsUpdatedAt });
    expect(merged.settings.sound).toBe(false);
    expect(merged.settings.themeMode).toBe('system');
  });

  it('a newer remote settings blob missing some keys keeps the local values for those keys', () => {
    const partial = { ...remote, settings: { themeMode: 'dark' } as CloudPayload['settings'] };
    const merged = mergeCloud(local, partial);
    expect(merged.settings).toMatchObject({ themeMode: 'dark', sound: false, hints: true, preset: 'classic' });
  });
});

describe('parsePayload is strict about shape', () => {
  const good = toPayload(data());
  it.each([
    ['missing settings', { ...good, settings: undefined }],
    ['missing stats', { ...good, stats: undefined }],
    ['missing unlocks', { ...good, unlocks: undefined }],
    ['missing daily', { ...good, daily: undefined }],
    ['wrong version', { ...good, v: 0 }],
    ['string version', { ...good, v: '1' }],
  ])('rejects %s', (_name, payload) => {
    expect(parsePayload(JSON.stringify(payload))).toBeNull();
  });

  it('accepts a payload with extra fields (forward compatible within v1)', () => {
    expect(parsePayload(JSON.stringify({ ...good, future: 1 }))).not.toBeNull();
  });

  it.each(['', '[]', '1', 'null', 'true'])('rejects %p', (raw) => {
    expect(parsePayload(raw)).toBeNull();
  });
});

function fakeKv(available = true): CloudKv & { store: Map<string, string>; fire: (keys: string[]) => void; listeners: number } {
  const store = new Map<string, string>();
  let listener: ((keys: string[]) => void) | null = null;
  const kv = {
    store,
    listeners: 0,
    fire: (keys: string[]) => listener?.(keys),
    isAvailable: () => available,
    getString: (k: string) => store.get(k) ?? null,
    setString: (k: string, v: string) => void store.set(k, v),
    synchronize: () => true,
    onChange(l: (keys: string[]) => void) {
      listener = l;
      kv.listeners++;
      return () => {
        listener = null;
        kv.listeners--;
      };
    },
  };
  return kv;
}

describe('sync runner lifecycle', () => {
  beforeEach(() => setUpAppData());

  it('syncs on foreground and background transitions but not on inactive, and stops cleanly', () => {
    const handlers: ((s: AppStateStatus) => void)[] = [];
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as (s: AppStateStatus) => void);
      return { remove };
    });
    const kv = fakeKv();
    const stop = startCloudSync(kv);
    const writesBefore = kv.store.size;
    expect(writesBefore).toBe(1);
    kv.store.delete(CLOUD_KEY);
    handlers[0]('inactive');
    expect(kv.store.has(CLOUD_KEY)).toBe(false);
    handlers[0]('active');
    expect(kv.store.has(CLOUD_KEY)).toBe(true);
    kv.store.delete(CLOUD_KEY);
    handlers[0]('background');
    expect(kv.store.has(CLOUD_KEY)).toBe(true);
    expect(kv.listeners).toBe(1);
    stop();
    expect(remove).toHaveBeenCalled();
    expect(kv.listeners).toBe(0);
    spy.mockRestore();
  });

  it('a corrupt cloud payload is ignored and overwritten with the local data', () => {
    const kv = fakeKv();
    kv.store.set(CLOUD_KEY, '{"v":1,"broken":');
    expect(syncWithCloud(kv)).toBe(true);
    expect(parsePayload(kv.store.get(CLOUD_KEY))).not.toBeNull();
    expect(getAppData().stats.sessions).toBe(0);
  });

  it('in read-only safe mode nothing is read from or written to iCloud', () => {
    const store = memoryStore();
    store.set('root', 'not json');
    initAppData(new Repository(store));
    const kv = fakeKv();
    kv.store.set(CLOUD_KEY, JSON.stringify(toPayload(data((d) => ({ ...d, stats: { ...d.stats, sessions: 99 } })))));
    expect(syncWithCloud(kv)).toBe(false);
    expect(kv.store.get(CLOUD_KEY)).toContain('99');
  });

  it('a change from another device while the app runs is merged and the merge is pushed back', () => {
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    const kv = fakeKv();
    const stop = startCloudSync(kv);
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 4 } }));
    kv.store.set(CLOUD_KEY, JSON.stringify(toPayload(data((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 2, sessions: 7 } })))));
    kv.fire([CLOUD_KEY]);
    expect(getAppData().stats).toMatchObject({ gamesCompleted: 4, sessions: 7 });
    expect(parsePayload(kv.store.get(CLOUD_KEY))?.stats).toMatchObject({ gamesCompleted: 4, sessions: 7 });
    stop();
    spy.mockRestore();
  });

  it('setString throwing is swallowed', () => {
    const kv = { ...fakeKv(), setString: () => { throw new Error('quota'); } };
    expect(syncWithCloud(kv)).toBe(false);
  });
});
