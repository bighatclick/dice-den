import { interstitialAfterFinal, prepareInterstitial, prepareRewarded, setAdProvider, watchRewarded } from '../../ads';
import { createFakeStore } from '../../iap/fakeStore';
import { setPurchaseStore } from '../../iap';
import { PRODUCT_IDS, entitlementsFor, packFor } from '../../iap/products';
import { createNativeStore } from '../../iap/nativeStore';
import { unavailableStore } from '../../iap/store';
import { createDefaultData } from '../../data/schema';
import { createFakeAds } from '../../testing/fakeAds';
import { setUpAppData } from '../../testing/appData';
import { getAppData, updateAppData } from '../appData';
import { ownedCosmetics, trialKey } from '../cosmetics';
import { hasRemoveAds, resetShopStore, useShopStore } from '../shopStore';
import { grantEarnedUnlocks } from '../unlocks';
import { withTimeout } from '../../util/timeout';

beforeEach(() => {
  setUpAppData();
  resetShopStore();
  setPurchaseStore(null);
  setAdProvider(null);
});

describe('products (specs.md §7.2)', () => {
  it('maps each product to what it unlocks', () => {
    expect(entitlementsFor([PRODUCT_IDS.removeAds])).toEqual({ removeAds: true, dice: [], tables: [] });
    expect(entitlementsFor([PRODUCT_IDS.classicPack])).toEqual({ removeAds: false, dice: ['bone', 'casinoRed', 'marble', 'glass'], tables: [] });
    expect(entitlementsFor([PRODUCT_IDS.tablePack]).tables).toEqual(['walnut', 'slate', 'night', 'oxblood']);
    expect(entitlementsFor([PRODUCT_IDS.complete])).toMatchObject({ removeAds: false, dice: expect.arrayContaining(['marble']), tables: expect.arrayContaining(['slate']) });
    expect(entitlementsFor([PRODUCT_IDS.supporter])).toMatchObject({ removeAds: true, dice: expect.arrayContaining(['glass']), tables: expect.arrayContaining(['night']) });
    expect(entitlementsFor(['com.other.app.thing'])).toEqual({ removeAds: false, dice: [], tables: [] });
    expect(packFor('classicPack')).toBe(PRODUCT_IDS.classicPack);
    expect(packFor('games10')).toBeNull();
  });
});

describe('shop store with the fake store', () => {
  it('loads store prices and cached purchases', async () => {
    const store = createFakeStore({ owned: [PRODUCT_IDS.tablePack] });
    setPurchaseStore(store);
    await useShopStore.getState().load();
    const s = useShopStore.getState();
    expect(s.status).toBe('ready');
    expect(s.prices[PRODUCT_IDS.removeAds]).toBe('$3.99');
    expect(s.owned).toEqual([PRODUCT_IDS.tablePack]);
    expect(getAppData().purchasesCache.productIds).toEqual([PRODUCT_IDS.tablePack]);
  });

  it('buys, and the purchase survives a relaunch with no store', async () => {
    const store = createFakeStore();
    setPurchaseStore(store);
    await useShopStore.getState().load();
    await useShopStore.getState().buy(PRODUCT_IDS.removeAds);
    expect(useShopStore.getState()).toMatchObject({ owned: [PRODUCT_IDS.removeAds], message: 'thanks', busy: null });
    expect(hasRemoveAds()).toBe(true);

    resetShopStore();
    setPurchaseStore(unavailableStore);
    useShopStore.getState().hydrate();
    await useShopStore.getState().load();
    expect(useShopStore.getState()).toMatchObject({ status: 'unavailable', owned: [PRODUCT_IDS.removeAds] });
  });

  it('handles cancel, failure and a pending purchase approved later', async () => {
    const store = createFakeStore();
    setPurchaseStore(store);
    await useShopStore.getState().load();
    store.nextOutcome = 'cancelled';
    await useShopStore.getState().buy(PRODUCT_IDS.classicPack);
    expect(useShopStore.getState()).toMatchObject({ owned: [], message: null });
    store.nextOutcome = 'failed';
    await useShopStore.getState().buy(PRODUCT_IDS.classicPack);
    expect(useShopStore.getState().message).toBe('failed');
    store.nextOutcome = 'pending';
    await useShopStore.getState().buy(PRODUCT_IDS.classicPack);
    expect(useShopStore.getState()).toMatchObject({ owned: [], message: 'pending' });
    store.approvePending(PRODUCT_IDS.classicPack);
    expect(useShopStore.getState()).toMatchObject({ owned: [PRODUCT_IDS.classicPack], message: 'thanks' });
  });

  it('restores purchases', async () => {
    setPurchaseStore(createFakeStore({ owned: [PRODUCT_IDS.supporter] }));
    await useShopStore.getState().restore();
    expect(useShopStore.getState()).toMatchObject({ owned: [PRODUCT_IDS.supporter], message: 'restored' });
    resetShopStore();
    setPurchaseStore(createFakeStore());
    await useShopStore.getState().restore();
    expect(useShopStore.getState().message).toBe('nothingToRestore');
    setPurchaseStore(unavailableStore);
    await useShopStore.getState().restore();
    expect(useShopStore.getState().message).toBe('restoreFailed');
  });

  it('gives up on a store that never answers after 2 seconds', async () => {
    jest.useFakeTimers();
    try {
      setPurchaseStore({ ...unavailableStore, connect: () => new Promise<boolean>(() => undefined) });
      const loading = useShopStore.getState().load();
      jest.advanceTimersByTime(2000);
      await loading;
      expect(useShopStore.getState().status).toBe('unavailable');
    } finally {
      jest.useRealTimers();
    }
  });

  it('withTimeout falls back on rejection too', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 50, 'fallback')).resolves.toBe('fallback');
  });

  it('the native store wrapper fails softly without a store', async () => {
    const native = createNativeStore();
    await expect(native.connect()).resolves.toBe(false);
  });
});

describe('cosmetics owned', () => {
  it('start items, earned unlocks, packs and running trials', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const data = createDefaultData();
    const mine = ownedCosmetics(data, [PRODUCT_IDS.tablePack], now);
    expect([...mine.dice]).toEqual(['ivory', 'walnut']);
    expect([...mine.tables]).toEqual(['felt', 'walnut', 'slate', 'night', 'oxblood']);

    const withTrial = { ...data, ads: { ...data.ads, trials: { [trialKey('dice', 'marble')]: '2026-10-18T00:00:00Z', [trialKey('table', 'walnut')]: '2026-10-18T00:00:00Z' } } };
    const trial = ownedCosmetics(withTrial, [PRODUCT_IDS.tablePack], now);
    expect(trial.dice.has('marble')).toBe(true);
    // The walnut table is bought, so its trial is not "trial only"; the walnut skin is unaffected.
    expect([...trial.trials]).toEqual(['dice:marble']);
    expect(ownedCosmetics(withTrial, [], new Date('2026-10-18T00:00:01Z')).dice.has('marble')).toBe(false);
  });

  it('earns a skin at 10 games and another at a 7-day streak, once', () => {
    const data = createDefaultData();
    expect(grantEarnedUnlocks({ ...data, stats: { ...data.stats, gamesCompleted: 9 } }).newly).toEqual([]);
    const ten = grantEarnedUnlocks({ ...data, stats: { ...data.stats, gamesCompleted: 10 } });
    expect(ten.newly).toEqual(['amber']);
    expect(grantEarnedUnlocks(ten.data).newly).toEqual([]);
    expect(grantEarnedUnlocks({ ...data, daily: { ...data.daily, bestStreak: 7 } }).newly).toEqual(['jade']);
  });
});

describe('ad service', () => {
  function readyForAds() {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 2, gamesCompleted: 3 } }));
  }

  it('preloads and shows an interstitial only when the rules allow, then records it', async () => {
    const ads = createFakeAds();
    setAdProvider(ads);
    readyForAds();
    await prepareInterstitial('normal');
    expect(ads.calls).toEqual(['init', 'loadInterstitial']);
    await expect(interstitialAfterFinal('normal', 1000)).resolves.toBe(false);
    await expect(interstitialAfterFinal('normal', 3000)).resolves.toBe(true);
    expect(getAppData().ads.gamesAtLastInterstitial).toBe(3);
    // The next one waits for 2 more games and 4 minutes.
    await prepareInterstitial('normal');
    expect(ads.calls.filter((c) => c === 'loadInterstitial')).toHaveLength(1);
  });

  it('shows nothing to Remove Ads owners or after the daily dice', async () => {
    const ads = createFakeAds();
    setAdProvider(ads);
    readyForAds();
    await expect(interstitialAfterFinal('daily', 9000)).resolves.toBe(false);
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.removeAds], updatedAt: null } }));
    await prepareInterstitial('normal');
    await expect(interstitialAfterFinal('normal', 9000)).resolves.toBe(false);
    expect(ads.calls).toEqual([]);
  });

  it('rewarded ads stay available after Remove Ads and stop at 3 a day', async () => {
    const ads = createFakeAds();
    setAdProvider(ads);
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.removeAds], updatedAt: null } }));
    await prepareRewarded();
    for (let i = 0; i < 3; i++) await expect(watchRewarded()).resolves.toBe('earned');
    await expect(watchRewarded()).resolves.toBe('unavailable');
    expect(ads.calls.filter((c) => c === 'showRewarded')).toHaveLength(3);
  });

  it('without consent nothing is requested', async () => {
    const ads = createFakeAds();
    ads.consent = false;
    setAdProvider(ads);
    readyForAds();
    await prepareInterstitial('normal');
    await expect(watchRewarded()).resolves.toBe('unavailable');
    expect(ads.calls).toEqual(['init']);
  });
});
