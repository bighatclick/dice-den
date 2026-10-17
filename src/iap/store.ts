import type { ProductId } from './products';

/** A product as the store reports it; `price` is the store's localised string. */
export interface StoreProduct {
  id: ProductId;
  price: string;
}

export type PurchaseOutcome =
  | { status: 'purchased'; productId: ProductId }
  /** Waiting for Ask to Buy or a slow payment method; it completes later through onPurchase. */
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'failed' };

/**
 * The app's view of StoreKit / Play Billing. The shop only talks to this, so
 * Jest and emulator runs can swap in the fake store (src/iap/fakeStore.ts).
 */
export interface PurchaseStore {
  /** False when there is no store (no account, no billing, Expo Go). */
  connect(): Promise<boolean>;
  products(ids: readonly ProductId[]): Promise<StoreProduct[]>;
  buy(id: ProductId): Promise<PurchaseOutcome>;
  /** Product ids this account owns. `restore` asks the store to re-sync first (iOS). */
  owned(restore: boolean): Promise<string[]>;
  /** Purchases that finish outside buy(): Ask to Buy approvals, pending payments. */
  onPurchase(listener: (productId: string) => void): () => void;
}

/** Used when no store can be reached: everything fails softly, play goes on. */
export const unavailableStore: PurchaseStore = {
  connect: async () => false,
  products: async () => [],
  buy: async () => ({ status: 'failed' }),
  owned: async () => [],
  onPurchase: () => () => undefined,
};
