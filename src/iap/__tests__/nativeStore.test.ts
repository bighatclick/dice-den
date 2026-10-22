import * as IAP from 'expo-iap';
import { Platform } from 'react-native';
import { createNativeStore } from '../nativeStore';
import { ALL_PRODUCT_IDS, entitlementsFor, isProductId, PRODUCT_IDS } from '../products';
import { getPurchaseStore, setPurchaseStore } from '..';
import { unavailableStore, type PurchaseStore } from '../store';
import { createFakeStore } from '../fakeStore';

type Listener = (p: unknown) => void;

/** Connects a store and captures the two listeners expo-iap gets. */
async function connected(): Promise<{ store: PurchaseStore; updated: Listener; errored: Listener }> {
  let updated: Listener = () => {};
  let errored: Listener = () => {};
  (IAP.initConnection as jest.Mock).mockResolvedValue(true);
  (IAP.purchaseUpdatedListener as jest.Mock).mockImplementation((l: Listener) => {
    updated = l;
    return { remove: jest.fn() };
  });
  (IAP.purchaseErrorListener as jest.Mock).mockImplementation((l: Listener) => {
    errored = l;
    return { remove: jest.fn() };
  });
  const store = createNativeStore();
  await expect(store.connect()).resolves.toBe(true);
  return { store, updated, errored };
}

beforeEach(() => {
  jest.clearAllMocks();
  (IAP.requestPurchase as jest.Mock).mockResolvedValue(null);
  (IAP.finishTransaction as jest.Mock).mockResolvedValue(undefined);
});

describe('products', () => {
  it('lists exactly five non-consumable ids with the app bundle prefix and no subscriptions', () => {
    expect(ALL_PRODUCT_IDS).toHaveLength(5);
    for (const id of ALL_PRODUCT_IDS) {
      expect(id.startsWith('com.dicedengame.app.')).toBe(true);
      expect(id).not.toMatch(/sub|month|year|coin|gem|roll|energy/i);
    }
    expect(isProductId('com.dicedengame.app.removeads')).toBe(true);
    expect(isProductId('com.dicedengame.app.REMOVEADS')).toBe(false);
    expect(isProductId('')).toBe(false);
  });

  it('owning several products merges their entitlements without duplicates', () => {
    const e = entitlementsFor([PRODUCT_IDS.classicPack, PRODUCT_IDS.complete, PRODUCT_IDS.removeAds, PRODUCT_IDS.classicPack]);
    expect(e.removeAds).toBe(true);
    expect(new Set(e.dice).size).toBe(e.dice.length);
    expect(e.dice).toEqual(['bone', 'casinoRed', 'marble', 'glass']);
    expect(e.tables).toEqual(['walnut', 'slate', 'night', 'oxblood']);
  });

  it('the Supporter Bundle is a superset of everything else', () => {
    const supporter = entitlementsFor([PRODUCT_IDS.supporter]);
    const everything = entitlementsFor(ALL_PRODUCT_IDS);
    expect(supporter).toEqual(everything);
  });
});

describe('native store: connection', () => {
  it('connects once and shares the promise between callers', async () => {
    const { store } = await connected();
    await Promise.all([store.connect(), store.connect()]);
    expect(IAP.initConnection).toHaveBeenCalledTimes(1);
    expect(IAP.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
  });

  it('a failed connection is not cached, so a later retry can succeed', async () => {
    (IAP.initConnection as jest.Mock).mockRejectedValueOnce(new Error('no billing'));
    const store = createNativeStore();
    await expect(store.connect()).resolves.toBe(false);
    (IAP.initConnection as jest.Mock).mockResolvedValueOnce(true);
    await expect(store.connect()).resolves.toBe(true);
    expect(IAP.initConnection).toHaveBeenCalledTimes(2);
  });

  it('treats an explicit false from initConnection as unavailable', async () => {
    (IAP.initConnection as jest.Mock).mockResolvedValueOnce(false);
    await expect(createNativeStore().connect()).resolves.toBe(false);
  });
});

describe('native store: products and ownership', () => {
  it('maps store products to prices and drops ids that are not ours', async () => {
    (IAP.fetchProducts as jest.Mock).mockResolvedValueOnce([
      { id: PRODUCT_IDS.removeAds, displayPrice: '€3,99' },
      { id: 'com.other.thing', displayPrice: '$1' },
    ]);
    const products = await createNativeStore().products(ALL_PRODUCT_IDS);
    expect(products).toEqual([{ id: PRODUCT_IDS.removeAds, price: '€3,99' }]);
    expect(IAP.fetchProducts).toHaveBeenCalledWith({ skus: [...ALL_PRODUCT_IDS], type: 'in-app' });
  });

  it('a null product list is an empty list', async () => {
    (IAP.fetchProducts as jest.Mock).mockResolvedValueOnce(null);
    await expect(createNativeStore().products(ALL_PRODUCT_IDS)).resolves.toEqual([]);
  });

  it('owned() returns only purchased known products and acknowledges unacknowledged Android ones', async () => {
    (IAP.getAvailablePurchases as jest.Mock).mockResolvedValueOnce([
      { productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased' },
      { productId: PRODUCT_IDS.classicPack, purchaseState: 'pending' },
      { productId: 'com.other', purchaseState: 'purchased' },
      { productId: PRODUCT_IDS.tablePack, purchaseState: 'purchased', isAcknowledgedAndroid: false },
    ]);
    const owned = await createNativeStore().owned(false);
    expect(owned).toEqual([PRODUCT_IDS.removeAds, PRODUCT_IDS.tablePack]);
    expect(IAP.finishTransaction).toHaveBeenCalledTimes(1);
    expect((IAP.finishTransaction as jest.Mock).mock.calls[0][0].purchase.productId).toBe(PRODUCT_IDS.tablePack);
  });

  it('restore on iOS re-syncs with the store first; on Android it does not', async () => {
    (IAP.getAvailablePurchases as jest.Mock).mockResolvedValue([]);
    await createNativeStore().owned(true);
    expect(IAP.restorePurchases).toHaveBeenCalledTimes(1);
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    await createNativeStore().owned(true);
    expect(IAP.restorePurchases).toHaveBeenCalledTimes(1);
    os.restore();
  });

  it('a failed acknowledgement does not drop the purchase', async () => {
    (IAP.getAvailablePurchases as jest.Mock).mockResolvedValueOnce([{ productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased', isAcknowledgedAndroid: false }]);
    (IAP.finishTransaction as jest.Mock).mockRejectedValueOnce(new Error('later'));
    await expect(createNativeStore().owned(false)).resolves.toEqual([PRODUCT_IDS.removeAds]);
  });
});

describe('native store: buying through purchase events', () => {
  it('resolves purchased when the update event arrives, after finishing the transaction', async () => {
    const { store, updated } = await connected();
    const outcome = store.buy(PRODUCT_IDS.removeAds);
    expect(IAP.requestPurchase).toHaveBeenCalledWith({ request: { apple: { sku: PRODUCT_IDS.removeAds }, google: { skus: [PRODUCT_IDS.removeAds] } }, type: 'in-app' });
    updated({ productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased' });
    await expect(outcome).resolves.toEqual({ status: 'purchased', productId: PRODUCT_IDS.removeAds });
    expect(IAP.finishTransaction).toHaveBeenCalledWith({ purchase: { productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased' }, isConsumable: false });
  });

  it('a purchase is granted even if finishing the transaction fails', async () => {
    const { store, updated } = await connected();
    (IAP.finishTransaction as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const outcome = store.buy(PRODUCT_IDS.classicPack);
    updated({ productId: PRODUCT_IDS.classicPack, purchaseState: 'purchased' });
    await expect(outcome).resolves.toEqual({ status: 'purchased', productId: PRODUCT_IDS.classicPack });
  });

  it('a pending purchase (Ask to Buy) resolves pending and completes later through onPurchase', async () => {
    const { store, updated } = await connected();
    const seen: string[] = [];
    store.onPurchase((id) => seen.push(id));
    const outcome = store.buy(PRODUCT_IDS.tablePack);
    updated({ productId: PRODUCT_IDS.tablePack, purchaseState: 'pending' });
    await expect(outcome).resolves.toEqual({ status: 'pending' });
    updated({ productId: PRODUCT_IDS.tablePack, purchaseState: 'purchased' });
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([PRODUCT_IDS.tablePack]);
  });

  it('a purchase event for an unknown product or a non-purchased state is ignored', async () => {
    const { store, updated } = await connected();
    const seen: string[] = [];
    store.onPurchase((id) => seen.push(id));
    updated({ productId: 'com.other', purchaseState: 'purchased' });
    updated({ productId: PRODUCT_IDS.removeAds, purchaseState: 'unspecified' });
    await Promise.resolve();
    expect(seen).toEqual([]);
    expect(IAP.finishTransaction).not.toHaveBeenCalled();
  });

  it('the user cancelling resolves cancelled, with or without a product id in the error', async () => {
    const { store, errored } = await connected();
    const a = store.buy(PRODUCT_IDS.removeAds);
    errored({ code: IAP.ErrorCode.UserCancelled, productId: PRODUCT_IDS.removeAds });
    await expect(a).resolves.toEqual({ status: 'cancelled' });
    const b = store.buy(PRODUCT_IDS.removeAds);
    errored({ code: IAP.ErrorCode.UserCancelled });
    await expect(b).resolves.toEqual({ status: 'cancelled' });
  });

  it('"already owned" is treated as a successful purchase', async () => {
    const { store, errored } = await connected();
    const outcome = store.buy(PRODUCT_IDS.supporter);
    errored({ code: IAP.ErrorCode.AlreadyOwned, productId: PRODUCT_IDS.supporter });
    await expect(outcome).resolves.toEqual({ status: 'purchased', productId: PRODUCT_IDS.supporter });
  });

  it('pending and deferred payment errors resolve pending', async () => {
    const { store, errored } = await connected();
    const a = store.buy(PRODUCT_IDS.removeAds);
    errored({ code: IAP.ErrorCode.Pending, productId: PRODUCT_IDS.removeAds });
    await expect(a).resolves.toEqual({ status: 'pending' });
    const b = store.buy(PRODUCT_IDS.removeAds);
    errored({ code: IAP.ErrorCode.DeferredPayment, productId: PRODUCT_IDS.removeAds });
    await expect(b).resolves.toEqual({ status: 'pending' });
  });

  it('any other error fails the purchase; one without a product id fails every open purchase', async () => {
    const { store, errored } = await connected();
    const a = store.buy(PRODUCT_IDS.removeAds);
    const b = store.buy(PRODUCT_IDS.classicPack);
    errored({ code: 'E_UNKNOWN' });
    await expect(a).resolves.toEqual({ status: 'failed' });
    await expect(b).resolves.toEqual({ status: 'failed' });
  });

  it('requestPurchase rejecting fails that purchase', async () => {
    const { store } = await connected();
    (IAP.requestPurchase as jest.Mock).mockRejectedValueOnce(new Error('no sheet'));
    await expect(store.buy(PRODUCT_IDS.removeAds)).resolves.toEqual({ status: 'failed' });
  });

  it('buying the same product twice cancels the first request', async () => {
    const { store, updated } = await connected();
    const first = store.buy(PRODUCT_IDS.removeAds);
    const second = store.buy(PRODUCT_IDS.removeAds);
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    updated({ productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased' });
    await expect(second).resolves.toEqual({ status: 'purchased', productId: PRODUCT_IDS.removeAds });
  });

  it('onPurchase listeners can be removed', async () => {
    const { store, updated } = await connected();
    const seen: string[] = [];
    const off = store.onPurchase((id) => seen.push(id));
    off();
    updated({ productId: PRODUCT_IDS.removeAds, purchaseState: 'purchased' });
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});

describe('store selection', () => {
  afterEach(() => setPurchaseStore(null));

  it('the fake store answers only with known products and honours delays', async () => {
    const store = createFakeStore({ delayMs: 1, prices: { [PRODUCT_IDS.removeAds]: '£2.99' } });
    const products = await store.products([PRODUCT_IDS.removeAds, 'com.other' as never]);
    expect(products).toEqual([{ id: PRODUCT_IDS.removeAds, price: '£2.99' }]);
    expect(store.calls).toEqual(['products']);
  });

  it('the fake store resets nextOutcome after one buy and ignores approvals of nothing pending', async () => {
    const store = createFakeStore();
    store.nextOutcome = 'failed';
    await expect(store.buy(PRODUCT_IDS.removeAds)).resolves.toEqual({ status: 'failed' });
    await expect(store.buy(PRODUCT_IDS.removeAds)).resolves.toEqual({ status: 'purchased', productId: PRODUCT_IDS.removeAds });
    const seen: string[] = [];
    store.onPurchase((id) => seen.push(id));
    store.approvePending(PRODUCT_IDS.classicPack);
    expect(seen).toEqual([]);
  });

  it('the unavailable store fails every operation softly', async () => {
    await expect(unavailableStore.connect()).resolves.toBe(false);
    await expect(unavailableStore.products(ALL_PRODUCT_IDS)).resolves.toEqual([]);
    await expect(unavailableStore.buy(PRODUCT_IDS.removeAds)).resolves.toEqual({ status: 'failed' });
    await expect(unavailableStore.owned(true)).resolves.toEqual([]);
    expect(() => unavailableStore.onPurchase(() => {})()).not.toThrow();
  });

  it('getPurchaseStore returns the injected store, then the native wrapper, and the env flag picks the fake', () => {
    const fake = createFakeStore();
    setPurchaseStore(fake);
    expect(getPurchaseStore()).toBe(fake);
    setPurchaseStore(null);
    const env = process.env.EXPO_PUBLIC_FAKE_STORE;
    process.env.EXPO_PUBLIC_FAKE_STORE = '1';
    try {
      const picked = getPurchaseStore();
      expect('approvePending' in picked).toBe(true);
    } finally {
      process.env.EXPO_PUBLIC_FAKE_STORE = env;
      setPurchaseStore(null);
    }
    const native = getPurchaseStore();
    expect('approvePending' in native).toBe(false);
    expect(typeof native.connect).toBe('function');
  });
});
