import v0Prerelease from '../migrations/__fixtures__/v0-prerelease.json';
import v1Saved from '../migrations/__fixtures__/v1-saved.json';
import { MIGRATIONS, runMigrations } from '../migrations';
import { backupKey, Repository, ROOT_KEY, type KeyValueStore } from '../repository';
import { createDefaultData, DEFAULT_ADS, DEFAULT_SETTINGS, SCHEMA_VERSION, type RootData } from '../schema';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string>; writes: string[] } {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    data,
    writes,
    getString: (k) => data.get(k),
    set: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

describe('default data', () => {
  it('is a fresh deep copy every time (no shared nested objects between launches)', () => {
    const a = createDefaultData();
    const b = createDefaultData();
    expect(a).toEqual(b);
    expect(a.settings).not.toBe(b.settings);
    expect(a.settings.dailyReminder).not.toBe(b.settings.dailyReminder);
    expect(a.ads).not.toBe(b.ads);
    expect(a.ads.rewarded).not.toBe(b.ads.rewarded);
    expect(a.ads.trials).not.toBe(b.ads.trials);
    expect(a.ads.reviewPrompts).not.toBe(b.ads.reviewPrompts);
    expect(a.unlocks.dice).not.toBe(b.unlocks.dice);
    // Mutating one never leaks into the shared DEFAULT constants.
    a.settings.dailyReminder.hour = 3;
    a.ads.trials['x'] = 'y';
    expect(DEFAULT_SETTINGS.dailyReminder.hour).toBe(19);
    expect(DEFAULT_ADS.trials).toEqual({});
  });

  it('is at the current schema version and survives a JSON round trip unchanged', () => {
    const d = createDefaultData();
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });

  it('starts with the free cosmetics only, no purchases, no streak, onboarding not done', () => {
    const d = createDefaultData();
    expect(d.unlocks).toEqual({ dice: ['ivory', 'walnut'], tables: ['felt'] });
    expect(d.purchasesCache.productIds).toEqual([]);
    expect(d.daily.streak).toBe(0);
    expect(d.settings.onboardingDone).toBe(false);
    expect(d.settings.preset).toBe('classic'); // specs.md §4.2: Classic is the default
    expect(d.settings.music).toBe(false); // specs.md §9: music off by default
    expect(d.settings.hints).toBe(true);
  });
});

describe('the migration chain from the oldest fixture to today', () => {
  it('is contiguous: each step starts where the previous one ended, ending at SCHEMA_VERSION', () => {
    let version = 0;
    for (const m of MIGRATIONS) {
      expect(m.from).toBe(version);
      expect(m.to).toBe(version + 1);
      expect(m.name).toMatch(new RegExp(`^${String(m.to).padStart(3, '0')}-`));
      version = m.to;
    }
    expect(version).toBe(SCHEMA_VERSION);
  });

  it('v0 → current: the result has exactly the current shape', () => {
    const result = runMigrations(v0Prerelease, 0, SCHEMA_VERSION) as RootData;
    expect(Object.keys(result).sort()).toEqual(Object.keys(createDefaultData()).sort());
    expect(Object.keys(result.settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(Object.keys(result.ads).sort()).toEqual(Object.keys(DEFAULT_ADS).sort());
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.settings.themeMode).toBe('dark');
  });

  it('v1 → current keeps the purchase cache (never lose a purchase) and the streak', () => {
    const result = runMigrations(v1Saved, 1, SCHEMA_VERSION) as RootData;
    expect(result.purchasesCache.productIds).toEqual(['com.dicedengame.app.removeads']);
    expect(result.daily.streak).toBe(3);
    expect(result.daily.bestStreak).toBe(5);
    expect(result.gameLog).toHaveLength(1);
    expect(result.stats.gamesCompleted).toBe(4);
  });

  it('is idempotent at the top: running the last migration again on current data changes nothing', () => {
    const current = runMigrations(v1Saved, 1, SCHEMA_VERSION) as RootData;
    const again = MIGRATIONS[MIGRATIONS.length - 1].migrate(current);
    expect(again).toEqual(current);
  });

  it('running from the current version to itself is a no-op', () => {
    const d = createDefaultData();
    expect(runMigrations(d, SCHEMA_VERSION, SCHEMA_VERSION)).toBe(d);
  });

  it('a migrated blob migrates cleanly again from any intermediate version', () => {
    const v1 = runMigrations(v0Prerelease, 0, 1);
    const v2 = runMigrations(v1, 1, 2);
    expect(v2).toEqual(runMigrations(v0Prerelease, 0, 2));
  });
});

describe('repository behaviour across launches', () => {
  it('launch 1 creates defaults; launch 2 reads them back without writing again', () => {
    const store = memoryStore();
    new Repository(store).load();
    expect(store.writes).toEqual([ROOT_KEY]);
    const second = new Repository(store);
    second.load();
    expect(store.writes).toEqual([ROOT_KEY]);
    expect(second.isReadOnly).toBe(false);
  });

  it('migration writes the backup before the migrated root, in that order', () => {
    const store = memoryStore({ [ROOT_KEY]: JSON.stringify(v1Saved) });
    new Repository(store).load();
    expect(store.writes).toEqual([backupKey(1), ROOT_KEY]);
  });

  it('a second launch after a migration finds current data and keeps the backup', () => {
    const store = memoryStore({ [ROOT_KEY]: JSON.stringify(v1Saved) });
    new Repository(store).load();
    const result = new Repository(store).load();
    expect(result.readOnly).toBe(false);
    expect(result.data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(JSON.parse(store.data.get(backupKey(1))!)).toEqual(v1Saved);
  });

  it('read-only mode after a newer-version blob refuses saves and reports once', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 5 });
    const store = memoryStore({ [ROOT_KEY]: raw });
    const onError = jest.fn();
    const repo = new Repository(store, { onError });
    repo.load();
    expect(repo.save(createDefaultData())).toBe(false);
    expect(repo.save(createDefaultData())).toBe(false);
    expect(store.data.get(ROOT_KEY)).toBe(raw);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe('repository.load:newer-version');
  });

  it('a blob with the current version but garbage inside is served as is (the migration layer does not validate shape)', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, settings: null });
    const store = memoryStore({ [ROOT_KEY]: raw });
    const result = new Repository(store).load();
    expect(result.readOnly).toBe(false);
    expect((result.data as unknown as { settings: unknown }).settings).toBeNull();
  });

  it('a custom target version migrates only that far', () => {
    const store = memoryStore({ [ROOT_KEY]: JSON.stringify({ schemaVersion: 0 }) });
    const migrations = [
      { from: 0, to: 1, name: '001-a', migrate: (d: unknown) => ({ ...(d as object), schemaVersion: 1 }) },
      { from: 1, to: 2, name: '002-b', migrate: (d: unknown) => ({ ...(d as object), schemaVersion: 2 }) },
    ];
    const result = new Repository(store, { targetVersion: 1, migrations }).load();
    expect(result.data.schemaVersion).toBe(1);
    expect(store.data.get(backupKey(0))).toBeDefined();
  });

  it('the v0 migration already produces the current shape, so later steps only have to keep it', () => {
    const v1 = runMigrations(v0Prerelease, 0, 1) as RootData;
    expect(v1.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(v1).sort()).toEqual(Object.keys(createDefaultData()).sort());
  });

  it('a store whose set() throws does not crash load() for an existing current blob', () => {
    const saved = JSON.stringify(createDefaultData());
    const store: KeyValueStore = {
      getString: () => saved,
      set: () => {
        throw new Error('disk full');
      },
    };
    expect(() => new Repository(store).load()).not.toThrow();
  });
});
