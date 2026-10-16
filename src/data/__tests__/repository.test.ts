import v0Prerelease from '../migrations/__fixtures__/v0-prerelease.json';
import { backupKey, Repository, ROOT_KEY, type KeyValueStore } from '../repository';
import { createDefaultData, SCHEMA_VERSION } from '../schema';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, getString: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
}

describe('Repository', () => {
  it('creates and saves defaults on first launch', () => {
    const store = memoryStore();
    const result = new Repository(store).load();
    expect(result).toEqual({ data: createDefaultData(), readOnly: false });
    expect(JSON.parse(store.data.get(ROOT_KEY)!)).toEqual(createDefaultData());
  });

  it('loads current-version data as is and saves changes', () => {
    const saved = createDefaultData();
    saved.stats.gamesCompleted = 7;
    const store = memoryStore({ [ROOT_KEY]: JSON.stringify(saved) });
    const repo = new Repository(store);
    expect(repo.load()).toEqual({ data: saved, readOnly: false });
    saved.stats.gamesCompleted = 8;
    expect(repo.save(saved)).toBe(true);
    expect(JSON.parse(store.data.get(ROOT_KEY)!).stats.gamesCompleted).toBe(8);
  });

  it('backs up the raw blob before migrating, then saves the migrated data', () => {
    const raw = JSON.stringify(v0Prerelease);
    const store = memoryStore({ [ROOT_KEY]: raw });
    const result = new Repository(store).load();
    expect(store.data.get(backupKey(0))).toBe(raw);
    expect(result.readOnly).toBe(false);
    expect(result.data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.data.settings.themeMode).toBe('dark');
    expect(JSON.parse(store.data.get(ROOT_KEY)!)).toEqual(result.data);
  });

  it('keeps the old data and goes read-only when a migration throws', () => {
    const raw = JSON.stringify({ schemaVersion: 0, settings: {} });
    const store = memoryStore({ [ROOT_KEY]: raw });
    const onError = jest.fn();
    const repo = new Repository(store, {
      migrations: [{ from: 0, to: 1, name: 'boom', migrate: () => { throw new Error('boom'); } }],
      onError,
    });
    const result = repo.load();
    expect(result).toMatchObject({ readOnly: true, reason: 'migration-failed' });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'repository.load:migration-failed');
    expect(store.data.get(ROOT_KEY)).toBe(raw);
    expect(store.data.get(backupKey(0))).toBe(raw);
    expect(repo.save(createDefaultData())).toBe(false);
    expect(store.data.get(ROOT_KEY)).toBe(raw);
  });

  it('never overwrites unreadable data', () => {
    const store = memoryStore({ [ROOT_KEY]: '{not json' });
    const repo = new Repository(store);
    expect(repo.load()).toMatchObject({ readOnly: true, reason: 'corrupt' });
    expect(repo.isReadOnly).toBe(true);
    repo.save(createDefaultData());
    expect(store.data.get(ROOT_KEY)).toBe('{not json');
  });

  it('does not touch data written by a newer app version', () => {
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 });
    const store = memoryStore({ [ROOT_KEY]: raw });
    expect(new Repository(store).load()).toMatchObject({ readOnly: true, reason: 'newer-version' });
    expect(store.data.get(ROOT_KEY)).toBe(raw);
  });

  it.each(['"just a string"', '{"schemaVersion":-1}', '{"schemaVersion":"1"}'])(
    'treats %s as a v0 blob',
    (raw) => {
      const store = memoryStore({ [ROOT_KEY]: raw });
      expect(new Repository(store).load().data).toEqual(createDefaultData());
      expect(store.data.get(backupKey(0))).toBe(raw);
    },
  );
});
