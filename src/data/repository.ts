import { MIGRATIONS, runMigrations, type Migration } from './migrations';
import { createDefaultData, SCHEMA_VERSION, type RootData } from './schema';

/** The subset of MMKV the repository needs; tests use an in-memory map. */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

export const ROOT_KEY = 'root';
export const backupKey = (version: number) => `backup_v${version}`;

export type LoadResult =
  | { data: RootData; readOnly: false }
  | { data: RootData; readOnly: true; reason: 'corrupt' | 'newer-version' | 'migration-failed' };

export interface RepositoryOptions {
  migrations?: readonly Migration[];
  targetVersion?: number;
  onError?: (error: unknown, context: string) => void;
}

/**
 * Loads and saves the single root blob. It never deletes or overwrites data it
 * could not read: on any failure it serves defaults in read-only safe mode.
 */
export class Repository {
  private readOnly = false;

  constructor(
    private readonly store: KeyValueStore,
    private readonly options: RepositoryOptions = {},
  ) {}

  get isReadOnly(): boolean {
    return this.readOnly;
  }

  load(): LoadResult {
    const target = this.options.targetVersion ?? SCHEMA_VERSION;
    const raw = this.store.getString(ROOT_KEY);
    if (raw === undefined) {
      const data = createDefaultData();
      this.save(data);
      return { data, readOnly: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return this.safeMode(error, 'corrupt');
    }

    const version = readVersion(parsed);
    if (version > target) return this.safeMode(new Error(`Data is schema v${version}`), 'newer-version');
    if (version === target) return { data: parsed as RootData, readOnly: false };

    this.store.set(backupKey(version), raw);
    try {
      const data = runMigrations(parsed, version, target, this.options.migrations ?? MIGRATIONS) as RootData;
      this.save(data);
      return { data, readOnly: false };
    } catch (error) {
      return this.safeMode(error, 'migration-failed');
    }
  }

  /** Returns false (and writes nothing) in read-only safe mode. */
  save(data: RootData): boolean {
    if (this.readOnly) return false;
    this.store.set(ROOT_KEY, JSON.stringify(data));
    return true;
  }

  private safeMode(error: unknown, reason: 'corrupt' | 'newer-version' | 'migration-failed'): LoadResult {
    this.readOnly = true;
    this.options.onError?.(error, `repository.load:${reason}`);
    return { data: createDefaultData(), readOnly: true, reason };
  }
}

function readVersion(parsed: unknown): number {
  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed) {
    const v = (parsed as { schemaVersion: unknown }).schemaVersion;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  }
  return 0;
}
