import { create } from 'zustand';
import { getPurchaseStore } from '../iap';
import { ALL_PRODUCT_IDS, entitlementsFor, type Entitlements, type ProductId } from '../iap/products';
import { SDK_TIMEOUT_MS, withTimeout } from '../util/timeout';
import { getAppData, updateAppData } from './appData';

export type ShopMessage = 'thanks' | 'pending' | 'failed' | 'restored' | 'nothingToRestore' | 'restoreFailed';

interface ShopStore {
  /** Owned product ids: the store is the source of truth, cached for offline launches. */
  owned: string[];
  /** Localised prices from the store; a product without one cannot be bought right now. */
  prices: Partial<Record<ProductId, string>>;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  busy: ProductId | 'restore' | null;
  message: ShopMessage | null;
  hydrate(): void;
  /** Connects, loads prices and owned products. Gives up after 2 s per call; never throws. */
  load(): Promise<void>;
  buy(id: ProductId): Promise<void>;
  restore(): Promise<void>;
  clearMessage(): void;
}

let unsubscribe: (() => void) | null = null;

function saveOwned(ids: readonly string[]): string[] {
  const merged = [...new Set([...getAppData().purchasesCache.productIds, ...ids])];
  updateAppData((d) => ({ ...d, purchasesCache: { productIds: merged, updatedAt: new Date().toISOString() } }));
  return merged;
}

export const useShopStore = create<ShopStore>()((set, get) => ({
  owned: [],
  prices: {},
  status: 'idle',
  busy: null,
  message: null,
  hydrate() {
    set({ owned: getAppData().purchasesCache.productIds });
  },
  async load() {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    const store = getPurchaseStore();
    const connected = await withTimeout(store.connect(), SDK_TIMEOUT_MS, false);
    if (!connected) {
      set({ status: 'unavailable' });
      return;
    }
    unsubscribe?.();
    unsubscribe = store.onPurchase((id) => set({ owned: saveOwned([id]), message: 'thanks' }));
    const [products, owned] = await Promise.all([
      withTimeout(store.products(ALL_PRODUCT_IDS), SDK_TIMEOUT_MS, []),
      withTimeout(store.owned(false), SDK_TIMEOUT_MS, []),
    ]);
    set({
      prices: Object.fromEntries(products.map((p) => [p.id, p.price])),
      // Never take away what was owned: a flaky empty answer must not remove a purchase.
      owned: saveOwned(owned),
      status: products.length > 0 ? 'ready' : 'unavailable',
    });
  },
  async buy(id) {
    if (get().busy) return;
    set({ busy: id, message: null });
    // The purchase sheet waits on the player, so there is no timeout here; play is never blocked by it.
    const outcome = await getPurchaseStore()
      .buy(id)
      .catch(() => ({ status: 'failed' as const }));
    if (outcome.status === 'purchased') set({ owned: saveOwned([outcome.productId]), message: 'thanks' });
    else if (outcome.status === 'pending') set({ message: 'pending' });
    else if (outcome.status === 'failed') set({ message: 'failed' });
    set({ busy: null });
  },
  async restore() {
    if (get().busy) return;
    set({ busy: 'restore', message: null });
    const store = getPurchaseStore();
    const connected = await withTimeout(store.connect(), SDK_TIMEOUT_MS, false);
    const owned = connected ? await store.owned(true).catch(() => null) : null;
    if (owned === null) set({ message: 'restoreFailed' });
    else set({ owned: saveOwned(owned), message: owned.length > 0 ? 'restored' : 'nothingToRestore' });
    set({ busy: null });
  },
  clearMessage() {
    set({ message: null });
  },
}));

export function useEntitlements(): Entitlements {
  const owned = useShopStore((s) => s.owned);
  return entitlementsFor(owned);
}

/** For non-React callers (the ad service): owned products as last cached. */
export function hasRemoveAds(): boolean {
  return entitlementsFor(getAppData().purchasesCache.productIds).removeAds;
}

/** Tests start each case from an empty shop. */
export function resetShopStore(): void {
  unsubscribe?.();
  unsubscribe = null;
  useShopStore.setState({ owned: [], prices: {}, status: 'idle', busy: null, message: null });
}
