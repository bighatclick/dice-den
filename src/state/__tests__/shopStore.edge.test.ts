import { createFakeStore } from '../../iap/fakeStore';
import { setPurchaseStore } from '../../iap';
import { PRODUCT_IDS } from '../../iap/products';
import { unavailableStore } from '../../iap/store';
import { setUpAppData } from '../../testing/appData';
import { getAppData, updateAppData } from '../appData';
import { ownedCosmetics, trialKey } from '../cosmetics';
import { hasRemoveAds, resetShopStore, useShopStore } from '../shopStore';
import { grantEarnedUnlocks } from '../unlocks';
import { createDefaultData } from '../../data/schema';
import { DICE_SKINS, TABLES, skinById, tableById } from '../../ui/cosmetics';

const shop = () => useShopStore.getState();

beforeEach(() => {
  setUpAppData();
  resetShopStore();
  setPurchaseStore(null);
});

describe('shop store edge cases', () => {
  it('load() while already loading is a no-op; a second load after success reloads', async () => {
    const store = createFakeStore({ delayMs: 5 });
    setPurchaseStore(store);
    const first = shop().load();
    const second = shop().load();
    await Promise.all([first, second]);
    expect(store.calls.filter((c) => c === 'connect')).toHaveLength(1);
    await shop().load();
    expect(store.calls.filter((c) => c === 'connect')).toHaveLength(2);
  });

  it('an empty owned() answer never removes a cached purchase', async () => {
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.removeAds], updatedAt: null } }));
    shop().hydrate();
    setPurchaseStore(createFakeStore({ owned: [] }));
    await shop().load();
    expect(shop().owned).toEqual([PRODUCT_IDS.removeAds]);
    expect(getAppData().purchasesCache.productIds).toEqual([PRODUCT_IDS.removeAds]);
    expect(hasRemoveAds()).toBe(true);
  });

  it('owned ids are de-duplicated across cache, load and purchases', async () => {
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.classicPack], updatedAt: null } }));
    const store = createFakeStore({ owned: [PRODUCT_IDS.classicPack] });
    setPurchaseStore(store);
    await shop().load();
    await shop().buy(PRODUCT_IDS.classicPack);
    expect(shop().owned).toEqual([PRODUCT_IDS.classicPack]);
  });

  it('a store that connects but has no products is "unavailable" while owned items still apply', async () => {
    const store = createFakeStore({ owned: [PRODUCT_IDS.tablePack] });
    store.products = async () => [];
    setPurchaseStore(store);
    await shop().load();
    expect(shop().status).toBe('unavailable');
    expect(shop().owned).toEqual([PRODUCT_IDS.tablePack]);
  });

  it('buy() is ignored while another purchase or a restore is busy', async () => {
    const store = createFakeStore({ delayMs: 5 });
    setPurchaseStore(store);
    const a = shop().buy(PRODUCT_IDS.removeAds);
    expect(shop().busy).toBe(PRODUCT_IDS.removeAds);
    await shop().buy(PRODUCT_IDS.classicPack);
    await a;
    expect(store.calls.filter((c) => c.startsWith('buy:'))).toEqual([`buy:${PRODUCT_IDS.removeAds}`]);
    const r = shop().restore();
    await shop().buy(PRODUCT_IDS.classicPack);
    await r;
    expect(store.calls.filter((c) => c.startsWith('buy:'))).toHaveLength(1);
    expect(shop().busy).toBeNull();
  });

  it('buy() rejecting is a failed purchase, not a crash, and busy is cleared', async () => {
    setPurchaseStore({ ...unavailableStore, buy: async () => { throw new Error('store down'); } });
    await shop().buy(PRODUCT_IDS.removeAds);
    expect(shop()).toMatchObject({ message: 'failed', busy: null, owned: [] });
  });

  it('a cancelled purchase leaves no message, so nothing nags the player', async () => {
    const store = createFakeStore();
    store.nextOutcome = 'cancelled';
    setPurchaseStore(store);
    await shop().buy(PRODUCT_IDS.removeAds);
    expect(shop().message).toBeNull();
  });

  it('restore while the store cannot connect reports restoreFailed and keeps what is owned', async () => {
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.supporter], updatedAt: null } }));
    shop().hydrate();
    setPurchaseStore(createFakeStore({ available: false }));
    await shop().restore();
    expect(shop()).toMatchObject({ message: 'restoreFailed', owned: [PRODUCT_IDS.supporter] });
  });

  it('restore whose owned() throws reports restoreFailed', async () => {
    const store = createFakeStore();
    store.owned = async () => {
      throw new Error('x');
    };
    setPurchaseStore(store);
    await shop().restore();
    expect(shop().message).toBe('restoreFailed');
  });

  it('a pending purchase approved after the shop reloads still arrives (one listener at a time)', async () => {
    const store = createFakeStore();
    setPurchaseStore(store);
    await shop().load();
    store.nextOutcome = 'pending';
    await shop().buy(PRODUCT_IDS.tablePack);
    await shop().load(); // re-subscribes; the old subscription is removed
    store.approvePending(PRODUCT_IDS.tablePack);
    expect(shop().owned).toEqual([PRODUCT_IDS.tablePack]);
    expect(shop().message).toBe('thanks');
  });

  it('clearMessage only clears the message', async () => {
    setPurchaseStore(createFakeStore());
    await shop().buy(PRODUCT_IDS.removeAds);
    shop().clearMessage();
    expect(shop()).toMatchObject({ message: null, owned: [PRODUCT_IDS.removeAds] });
  });

  it('the purchase cache is stamped with the time of the last store answer', async () => {
    setPurchaseStore(createFakeStore({ owned: [PRODUCT_IDS.removeAds] }));
    await shop().load();
    expect(getAppData().purchasesCache.updatedAt).not.toBeNull();
    expect(Date.parse(getAppData().purchasesCache.updatedAt!)).not.toBeNaN();
  });
});

describe('cosmetics catalogue (specs.md §7.2)', () => {
  it('has 2 free skins, 1 free table, 2 earned skins, 4 pack skins and 4 pack tables, with unique ids', () => {
    const by = (source: string, list: readonly { source: string }[]) => list.filter((x) => x.source === source).length;
    expect(by('start', DICE_SKINS)).toBe(2);
    expect(by('games10', DICE_SKINS)).toBe(1);
    expect(by('streak7', DICE_SKINS)).toBe(1);
    expect(by('classicPack', DICE_SKINS)).toBe(4);
    expect(by('start', TABLES)).toBe(1);
    expect(by('tablePack', TABLES)).toBe(4);
    expect(new Set(DICE_SKINS.map((s) => s.id)).size).toBe(DICE_SKINS.length);
    expect(new Set(TABLES.map((t) => t.id)).size).toBe(TABLES.length);
    expect(skinById('nope')).toBeUndefined();
    expect(tableById('nope')).toBeUndefined();
  });

  it('every skin has a high-contrast pip colour that is pure black or white', () => {
    for (const s of DICE_SKINS) expect(['#000000', '#FFFFFF']).toContain(s.contrastPip);
  });

  it('trials of unknown ids or malformed keys are ignored, and a trial of an owned item is not a trial', () => {
    const data = createDefaultData();
    const future = '2099-01-01T00:00:00Z';
    data.ads.trials = {
      [trialKey('dice', 'nope')]: future,
      'garbage': future,
      [trialKey('table', 'felt')]: future, // owned from the start
      [trialKey('dice', 'walnut')]: future, // free start skin
      [trialKey('table', 'night')]: future,
    };
    const mine = ownedCosmetics(data, [], new Date('2026-10-17T00:00:00Z'));
    expect([...mine.trials]).toEqual(['table:night']);
    expect(mine.dice.has('nope')).toBe(false);
    expect(mine.tables.has('night')).toBe(true);
  });

  it('earned unlocks persist as unlocks even after the condition is no longer visible', () => {
    const data = createDefaultData();
    const granted = grantEarnedUnlocks({ ...data, stats: { ...data.stats, gamesCompleted: 10 } });
    expect(ownedCosmetics(granted.data, [], new Date()).dice.has('amber')).toBe(true);
  });

  it('both earned skins can be granted in the same call, and the order is stable', () => {
    const data = createDefaultData();
    const both = grantEarnedUnlocks({ ...data, stats: { ...data.stats, gamesCompleted: 10 }, daily: { ...data.daily, bestStreak: 7 } });
    expect(both.newly).toEqual(['amber', 'jade']);
    expect(both.data.unlocks.dice).toEqual(['ivory', 'walnut', 'amber', 'jade']);
    expect(both.data.unlocks.tables).toEqual(['felt']);
  });

  it('grantEarnedUnlocks returns the same object when nothing is new', () => {
    const data = createDefaultData();
    expect(grantEarnedUnlocks(data).data).toBe(data);
  });
});
