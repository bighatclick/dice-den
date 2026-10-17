import { createFakeStore } from './fakeStore';
import { unavailableStore, type PurchaseStore } from './store';

let store: PurchaseStore | null = null;

/**
 * The store the shop talks to: the fake one when `EXPO_PUBLIC_FAKE_STORE=1`
 * (emulator runs without store accounts), else StoreKit / Play Billing, else
 * a store that is simply unavailable (Expo Go, no native module).
 */
export function getPurchaseStore(): PurchaseStore {
  if (store) return store;
  if (process.env.EXPO_PUBLIC_FAKE_STORE === '1') {
    store = createFakeStore({ delayMs: 600 });
    return store;
  }
  try {
    // Loaded lazily so a build without the native module still runs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = (require('./nativeStore') as typeof import('./nativeStore')).createNativeStore();
  } catch {
    store = unavailableStore;
  }
  return store;
}

/** Tests swap in a fake store. */
export function setPurchaseStore(next: PurchaseStore | null): void {
  store = next;
}
