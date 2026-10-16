import { migration001Initial } from './001-initial';
import type { Migration } from './types';

export type { Migration } from './types';

/** Ordered; each migration's `from` must equal the previous one's `to`. */
export const MIGRATIONS: readonly Migration[] = [migration001Initial];

export function runMigrations(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
): unknown {
  let version = fromVersion;
  let current = data;
  while (version < toVersion) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new Error(`No migration from schema v${version}`);
    current = step.migrate(current);
    version = step.to;
  }
  return current;
}
