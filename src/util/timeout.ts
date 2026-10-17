/**
 * Resolves with `fallback` if `promise` takes longer than `ms` or rejects.
 * Ads and the store use it so a slow or broken SDK never blocks play (CLAUDE.md rule 9).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** CLAUDE.md rule 9: an ad or store call gets 2 seconds, then the app moves on. */
export const SDK_TIMEOUT_MS = 2000;
