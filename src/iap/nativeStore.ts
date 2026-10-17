import { Platform } from 'react-native';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import { isProductId, type ProductId } from './products';
import type { PurchaseOutcome, PurchaseStore, StoreProduct } from './store';

/**
 * StoreKit 2 / Play Billing through expo-iap. Purchases arrive as
 * events, so buy() parks a resolver per product until its event comes back.
 * Every product is non-consumable: finished once, owned forever.
 */
type PurchaseError = Parameters<Parameters<typeof purchaseErrorListener>[0]>[0];

export function createNativeStore(): PurchaseStore {
  const waiting = new Map<string, (outcome: PurchaseOutcome) => void>();
  const listeners = new Set<(productId: string) => void>();
  let connecting: Promise<boolean> | null = null;

  function settle(productId: string | null | undefined, outcome: PurchaseOutcome): boolean {
    const resolve = productId ? waiting.get(productId) : undefined;
    if (!productId || !resolve) return false;
    waiting.delete(productId);
    resolve(outcome);
    return true;
  }

  async function onPurchase(purchase: Purchase) {
    const id = purchase.productId;
    if (!isProductId(id)) return;
    if (purchase.purchaseState === 'pending') {
      settle(id, { status: 'pending' });
      return;
    }
    if (purchase.purchaseState !== 'purchased') return;
    // Unfinished Play purchases are refunded after 3 days, so finish before granting.
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Still owned: the next owned() call finishes it again.
    }
    if (!settle(id, { status: 'purchased', productId: id })) listeners.forEach((l) => l(id));
  }

  function onError(error: PurchaseError) {
    const id = error.productId;
    if (error.code === ErrorCode.AlreadyOwned && id && isProductId(id)) {
      settle(id, { status: 'purchased', productId: id });
    } else if (error.code === ErrorCode.UserCancelled) {
      if (!settle(id, { status: 'cancelled' })) waiting.forEach((r) => r({ status: 'cancelled' }));
    } else if (error.code === ErrorCode.Pending || error.code === ErrorCode.DeferredPayment) {
      settle(id, { status: 'pending' });
    } else if (!settle(id, { status: 'failed' })) {
      // An error without a product id ends whatever purchase is open.
      waiting.forEach((r) => r({ status: 'failed' }));
      waiting.clear();
    }
  }

  return {
    connect() {
      connecting ??= (async () => {
        try {
          const ok = await initConnection();
          purchaseUpdatedListener((p) => void onPurchase(p));
          purchaseErrorListener(onError);
          return ok !== false;
        } catch {
          connecting = null;
          return false;
        }
      })();
      return connecting;
    },
    async products(ids) {
      const found = await fetchProducts({ skus: [...ids], type: 'in-app' });
      return (found ?? []).flatMap((p): StoreProduct[] =>
        isProductId(p.id) ? [{ id: p.id as ProductId, price: p.displayPrice }] : [],
      );
    },
    buy(id) {
      return new Promise<PurchaseOutcome>((resolve) => {
        waiting.get(id)?.({ status: 'cancelled' });
        waiting.set(id, resolve);
        requestPurchase({ request: { apple: { sku: id }, google: { skus: [id] } }, type: 'in-app' }).catch(() =>
          settle(id, { status: 'failed' }),
        );
      });
    },
    async owned(restore) {
      if (restore && Platform.OS === 'ios') await restorePurchases();
      const purchases = await getAvailablePurchases();
      const owned: string[] = [];
      for (const p of purchases) {
        if (!isProductId(p.productId) || p.purchaseState !== 'purchased') continue;
        owned.push(p.productId);
        if ('isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid === false) {
          await finishTransaction({ purchase: p, isConsumable: false }).catch(() => undefined);
        }
      }
      return owned;
    },
    onPurchase(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
