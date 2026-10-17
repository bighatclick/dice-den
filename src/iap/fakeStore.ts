import { ALL_PRODUCT_IDS, type ProductId } from './products';
import type { PurchaseOutcome, PurchaseStore, StoreProduct } from './store';

export interface FakeStoreOptions {
  available?: boolean;
  /** Stand-in prices, as a store would send them. Only the fake store has these. */
  prices?: Partial<Record<ProductId, string>>;
  owned?: string[];
  /** Milliseconds each call takes. */
  delayMs?: number;
}

export interface FakeStore extends PurchaseStore {
  ownedIds: Set<string>;
  /** The outcome of the next buy(); 'purchased' by default. */
  nextOutcome: PurchaseOutcome['status'];
  /** Finishes a pending purchase, as an Ask to Buy approval would. */
  approvePending(id: ProductId): void;
  available: boolean;
  calls: string[];
}

const SAMPLE_PRICES: Record<ProductId, string> = {
  'com.dicedengame.app.removeads': '$3.99',
  'com.dicedengame.app.pack.classic': '$1.99',
  'com.dicedengame.app.pack.tables': '$1.99',
  'com.dicedengame.app.complete': '$6.99',
  'com.dicedengame.app.supporter': '$9.99',
};

/**
 * In-memory store for Jest and for emulator runs without store accounts
 * (`EXPO_PUBLIC_FAKE_STORE=1`). Never used in a release build.
 */
export function createFakeStore(options: FakeStoreOptions = {}): FakeStore {
  const listeners = new Set<(id: string) => void>();
  const pending = new Set<ProductId>();
  const prices = { ...SAMPLE_PRICES, ...options.prices };
  const wait = () => new Promise<void>((r) => setTimeout(r, options.delayMs ?? 0));

  const store: FakeStore = {
    ownedIds: new Set(options.owned ?? []),
    nextOutcome: 'purchased',
    available: options.available ?? true,
    calls: [],
    async connect() {
      store.calls.push('connect');
      await wait();
      return store.available;
    },
    async products(ids) {
      store.calls.push('products');
      await wait();
      if (!store.available) return [];
      return ids.filter((id) => ALL_PRODUCT_IDS.includes(id)).map((id): StoreProduct => ({ id, price: prices[id] }));
    },
    async buy(id) {
      store.calls.push(`buy:${id}`);
      await wait();
      const status = store.nextOutcome;
      store.nextOutcome = 'purchased';
      if (status === 'purchased') {
        store.ownedIds.add(id);
        return { status, productId: id };
      }
      if (status === 'pending') pending.add(id);
      return { status };
    },
    async owned(restore) {
      store.calls.push(restore ? 'restore' : 'owned');
      await wait();
      return [...store.ownedIds];
    },
    onPurchase(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    approvePending(id) {
      if (!pending.delete(id)) return;
      store.ownedIds.add(id);
      listeners.forEach((l) => l(id));
    },
  };
  return store;
}
