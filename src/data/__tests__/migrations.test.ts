import v0Prerelease from '../migrations/__fixtures__/v0-prerelease.json';
import { migration001Initial } from '../migrations/001-initial';
import { MIGRATIONS, runMigrations, type Migration } from '../migrations';
import { createDefaultData, SCHEMA_VERSION } from '../schema';

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
