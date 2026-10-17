import v0Prerelease from '../migrations/__fixtures__/v0-prerelease.json';
import v1Saved from '../migrations/__fixtures__/v1-saved.json';
import { migration002CosmeticsAndAds } from '../migrations/002-cosmetics-and-ads';
import { Repository } from '../repository';
import { migration001Initial } from '../migrations/001-initial';
import { MIGRATIONS, runMigrations, type Migration } from '../migrations';
import { createDefaultData, DEFAULT_ADS, SCHEMA_VERSION } from '../schema';

describe('migration chain', () => {
  it('covers every version up to the current schema', () => {
    for (let v = 0; v < SCHEMA_VERSION; v++) {
      expect(MIGRATIONS.filter((m) => m.from === v)).toHaveLength(1);
    }
    expect(MIGRATIONS.map((m) => m.to)).toContain(SCHEMA_VERSION);
  });

  it('runs steps in order', () => {
    const steps: Migration[] = [
      { from: 1, to: 2, name: 'b', migrate: (d) => `${d}b` },
      { from: 0, to: 1, name: 'a', migrate: (d) => `${d}a` },
    ];
    expect(runMigrations('', 0, 2, steps)).toBe('ab');
  });

  it('throws when a step is missing', () => {
    expect(() => runMigrations({}, 0, 2, [migration001Initial])).toThrow('No migration from schema v1');
  });
});

describe('001-initial (v0 → v1)', () => {
  it('keeps known, well-typed settings from the v0 fixture and drops the rest', () => {
    const result = migration001Initial.migrate(v0Prerelease);
    const expected = createDefaultData();
    expected.settings.themeMode = 'dark';
    expected.settings.hints = false;
    expected.settings.preset = 'scandinavian';
    expect(result).toEqual(expected);
  });

  it.each([null, 'text', [1, 2], { settings: 'nope' }])('turns %p into defaults', (input) => {
    expect(migration001Initial.migrate(input)).toEqual(createDefaultData());
  });
});

describe('002-cosmetics-and-ads (v1 → v2)', () => {
  it('keeps every v1 value and adds the v2 defaults', () => {
    const result = migration002CosmeticsAndAds.migrate(v1Saved) as ReturnType<typeof createDefaultData>;
    expect(result.schemaVersion).toBe(2);
    expect(result.settings).toEqual({
      ...v1Saved.settings,
      reduceMotion: false,
      aiSpeed: 'normal',
      diceSkin: 'ivory',
      table: 'felt',
    });
    expect(result.stats).toEqual(v1Saved.stats);
    expect(result.gameLog).toEqual(v1Saved.gameLog);
    expect(result.daily).toEqual({ ...v1Saved.daily, reminderAsked: false });
    expect(result.purchasesCache).toEqual(v1Saved.purchasesCache);
    expect(result.ads).toEqual(DEFAULT_ADS);
    expect(result.syncMeta).toEqual({ settingsUpdatedAt: null });
    // Nothing is left out: the result has exactly the v2 shape.
    expect(Object.keys(result).sort()).toEqual(Object.keys(createDefaultData()).sort());
  });

  it('never overwrites v2 fields that are already there', () => {
    const partial = { ...v1Saved, settings: { ...v1Saved.settings, diceSkin: 'marble' }, ads: { ...DEFAULT_ADS, attPrompted: true } };
    const result = migration002CosmeticsAndAds.migrate(partial) as ReturnType<typeof createDefaultData>;
    expect(result.settings.diceSkin).toBe('marble');
    expect(result.ads.attPrompted).toBe(true);
  });

  it('refuses a non-object so the repository keeps the old data', () => {
    expect(() => migration002CosmeticsAndAds.migrate('x')).toThrow();
  });

  it('runs through the repository with a backup of the v1 blob', () => {
    const raw = JSON.stringify(v1Saved);
    const map = new Map([['root', raw]]);
    const repo = new Repository({ getString: (k) => map.get(k), set: (k, v) => void map.set(k, v) });
    const loaded = repo.load();
    expect(loaded.readOnly).toBe(false);
    expect(loaded.data.schemaVersion).toBe(2);
    expect(map.get('backup_v1')).toBe(raw);
    expect(JSON.parse(map.get('root')!).daily.results).toEqual({ '2026-10-15': 244 });
  });
});
