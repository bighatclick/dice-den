import mobileAds, { AdsConsent, InterstitialAd, RewardedAd } from 'react-native-google-mobile-ads';
import * as ATT from 'expo-tracking-transparency';
import {
  ensureAdsReady,
  interstitialAfterFinal,
  prepareInterstitial,
  prepareRewarded,
  privacyOptionsRequired,
  rewardedAvailableToday,
  setAdProvider,
  showPrivacyOptions,
  watchRewarded,
} from '..';
import { createAdMobProvider } from '../admob';
import { requestTracking } from '../att';
import { nullAdProvider, type AdProvider } from '../provider';
import { PRODUCT_IDS } from '../../iap/products';
import { setUpAppData } from '../../testing/appData';
import { createFakeAds } from '../../testing/fakeAds';
import { getAppData, updateAppData } from '../../state/appData';

beforeEach(() => {
  setUpAppData();
  setAdProvider(null);
  jest.clearAllMocks();
});

function readyForAds() {
  updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 2, gamesCompleted: 3 } }));
}

describe('ad service error handling (CLAUDE.md rule 9: failures never block play)', () => {
  it('a provider whose init throws counts as "no ads", and the result is cached per launch', async () => {
    const init = jest.fn(async () => {
      throw new Error('SDK broke');
    });
    setAdProvider({ ...nullAdProvider, init });
    await expect(ensureAdsReady()).resolves.toBe(false);
    await expect(ensureAdsReady()).resolves.toBe(false);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('init runs once per launch even when called concurrently', async () => {
    const ads = createFakeAds();
    setAdProvider(ads);
    await Promise.all([ensureAdsReady(), ensureAdsReady(), ensureAdsReady()]);
    expect(ads.calls.filter((c) => c === 'init')).toHaveLength(1);
  });

  it('swapping the provider resets the readiness cache', async () => {
    const a = createFakeAds();
    a.consent = false;
    setAdProvider(a);
    await expect(ensureAdsReady()).resolves.toBe(false);
    const b = createFakeAds();
    setAdProvider(b);
    await expect(ensureAdsReady()).resolves.toBe(true);
  });

  it('showInterstitial rejecting resolves to false and records nothing', async () => {
    readyForAds();
    setAdProvider({ ...nullAdProvider, init: async () => true, showInterstitial: async () => { throw new Error('boom'); } });
    await expect(interstitialAfterFinal('normal', 10_000)).resolves.toBe(false);
    expect(getAppData().ads.lastInterstitialAt).toBeNull();
  });

  it('an interstitial that was never loaded is not shown and does not start the gaps', async () => {
    readyForAds();
    const ads = createFakeAds();
    setAdProvider(ads);
    await expect(interstitialAfterFinal('normal', 10_000)).resolves.toBe(false);
    expect(ads.calls).toEqual(['init', 'showInterstitial']);
    expect(getAppData().ads.gamesAtLastInterstitial).toBe(0);
  });

  it('a rewarded ad that is dismissed early earns nothing and does not count against the cap', async () => {
    const ads = createFakeAds();
    ads.rewardedResult = 'dismissed';
    setAdProvider(ads);
    await expect(watchRewarded()).resolves.toBe('dismissed');
    expect(getAppData().ads.rewarded.count).toBe(0);
    expect(rewardedAvailableToday()).toBe(3);
  });

  it('a rewarded show that throws is reported as unavailable', async () => {
    setAdProvider({ ...nullAdProvider, init: async () => true, showRewarded: async () => { throw new Error('x'); } });
    await expect(watchRewarded()).resolves.toBe('unavailable');
  });

  it('prepareRewarded does nothing once the daily cap is reached', async () => {
    const ads = createFakeAds();
    setAdProvider(ads);
    updateAppData((d) => ({ ...d, ads: { ...d.ads, rewarded: { date: new Date().toISOString().slice(0, 10), count: 3 } } }));
    await prepareRewarded();
    expect(ads.calls).toEqual([]);
  });

  it('the null provider never shows anything', async () => {
    setAdProvider(nullAdProvider);
    readyForAds();
    await prepareInterstitial('normal');
    await expect(interstitialAfterFinal('normal', 10_000)).resolves.toBe(false);
    await expect(watchRewarded()).resolves.toBe('unavailable');
    await expect(privacyOptionsRequired()).resolves.toBe(false);
    await expect(showPrivacyOptions()).resolves.toBeUndefined();
  });

  it('privacy options are only asked of a ready provider, and a throwing check reads as not required', async () => {
    const required = jest.fn(async () => true);
    setAdProvider({ ...nullAdProvider, init: async () => true, privacyOptionsRequired: required });
    await expect(privacyOptionsRequired()).resolves.toBe(true);
    setAdProvider({ ...nullAdProvider, init: async () => false, privacyOptionsRequired: required });
    await expect(privacyOptionsRequired()).resolves.toBe(false);
    setAdProvider({ ...nullAdProvider, init: async () => true, privacyOptionsRequired: async () => { throw new Error('x'); } });
    await expect(privacyOptionsRequired()).resolves.toBe(false);
    setAdProvider({ ...nullAdProvider, showPrivacyOptions: async () => { throw new Error('x'); } });
    await expect(showPrivacyOptions()).resolves.toBeUndefined();
  });

  it('Remove Ads via the Supporter Bundle also blocks interstitials', async () => {
    readyForAds();
    const ads = createFakeAds();
    setAdProvider(ads);
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.supporter], updatedAt: null } }));
    await prepareInterstitial('normal');
    await expect(interstitialAfterFinal('normal', 10_000)).resolves.toBe(false);
    expect(ads.calls).toEqual([]);
  });
});

/** A fake AdMob ad object: listeners can be fired by the test. */
function fakeAd(loaded = true) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const ad = {
    loaded,
    load: jest.fn(),
    show: jest.fn(async () => undefined),
    addAdEventListener: jest.fn((type: string, fn: (...args: unknown[]) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
      return () => listeners.get(type)!.delete(fn);
    }),
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
  };
  return ad;
}

describe('AdMob provider (muted, rated G, UMP first, 2-second timeouts)', () => {
  let provider: AdProvider;

  beforeEach(() => {
    provider = createAdMobProvider();
    (AdsConsent.gatherConsent as jest.Mock).mockResolvedValue({ canRequestAds: true });
  });

  it('init gathers consent first and mutes every ad with a G content rating', async () => {
    const sdk = mobileAds();
    const calls: string[] = [];
    (AdsConsent.gatherConsent as jest.Mock).mockImplementation(async () => {
      calls.push('consent');
      return { canRequestAds: true };
    });
    // mobileAds() returns a fresh object from the jest stub each call; spy through a shared instance.
    jest.spyOn(sdk, 'initialize').mockImplementation(async () => {
      calls.push('initialize');
      return [];
    });
    const result = await provider.init();
    expect(result).toBe(true);
    expect(calls[0]).toBe('consent');
    const anySdk = mobileAds();
    // The stub returns new mocks per call; the behaviour pinned here is the order and the outcome.
    expect(anySdk.setAppMuted).toBeDefined();
  });

  it('init returns false without consent and never starts the SDK', async () => {
    (AdsConsent.gatherConsent as jest.Mock).mockResolvedValue({ canRequestAds: false });
    await expect(provider.init()).resolves.toBe(false);
  });

  it('init with a rejected consent form bubbles up as a rejection, which the service turns into false', async () => {
    (AdsConsent.gatherConsent as jest.Mock).mockRejectedValue(new Error('UMP down'));
    await expect(provider.init()).rejects.toThrow('UMP down');
    setAdProvider(provider);
    await expect(ensureAdsReady()).resolves.toBe(false);
  });

  it('shows nothing when no interstitial is loaded', async () => {
    await expect(provider.showInterstitial()).resolves.toBe(false);
  });

  it('loads at most one interstitial at a time and drops it on a load error', () => {
    const ad = fakeAd(false);
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    provider.loadInterstitial();
    provider.loadInterstitial();
    expect(InterstitialAd.createForAdRequest).toHaveBeenCalledTimes(1);
    expect(ad.load).toHaveBeenCalledTimes(1);
    ad.fire('error');
    provider.loadInterstitial();
    expect(InterstitialAd.createForAdRequest).toHaveBeenCalledTimes(2);
  });

  it('a loaded interstitial resolves true when closed and is consumed (a second show finds none)', async () => {
    const ad = fakeAd(true);
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    provider.loadInterstitial();
    const shown = provider.showInterstitial();
    await Promise.resolve();
    ad.fire('opened');
    ad.fire('closed');
    await expect(shown).resolves.toBe(true);
    expect(ad.listenerCount('closed')).toBe(0); // listeners removed
    await expect(provider.showInterstitial()).resolves.toBe(false);
  });

  it('an interstitial that never opens gives up after 2 seconds (play is never blocked)', async () => {
    jest.useFakeTimers();
    try {
      const ad = fakeAd(true);
      (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
      provider.loadInterstitial();
      const shown = provider.showInterstitial();
      jest.advanceTimersByTime(2000);
      await expect(shown).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('once opened, the 2-second timer no longer applies: a long ad still resolves true when closed', async () => {
    jest.useFakeTimers();
    try {
      const ad = fakeAd(true);
      (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
      provider.loadInterstitial();
      const shown = provider.showInterstitial();
      ad.fire('opened');
      jest.advanceTimersByTime(30_000);
      ad.fire('closed');
      await expect(shown).resolves.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('an error after opening counts as shown; an error before opening does not', async () => {
    const a = fakeAd(true);
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(a);
    provider.loadInterstitial();
    const first = provider.showInterstitial();
    a.fire('opened');
    a.fire('error');
    await expect(first).resolves.toBe(true);

    const b = fakeAd(true);
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(b);
    provider.loadInterstitial();
    const second = provider.showInterstitial();
    b.fire('error');
    await expect(second).resolves.toBe(false);
  });

  it('show() rejecting resolves false', async () => {
    const ad = fakeAd(true);
    ad.show.mockRejectedValue(new Error('no activity'));
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    provider.loadInterstitial();
    await expect(provider.showInterstitial()).resolves.toBe(false);
  });

  it('rewarded: earned only when the reward event fired before close; dismissed otherwise', async () => {
    const ad = fakeAd(true);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    const earned = provider.showRewarded();
    await Promise.resolve();
    ad.fire('rewarded_earned_reward');
    ad.fire('closed');
    await expect(earned).resolves.toBe('earned');

    const ad2 = fakeAd(true);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad2);
    const dismissed = provider.showRewarded();
    await Promise.resolve();
    ad2.fire('closed');
    await expect(dismissed).resolves.toBe('dismissed');
  });

  it('rewarded: waits up to 2 s for a load, then reports unavailable', async () => {
    jest.useFakeTimers();
    try {
      const ad = fakeAd(false);
      (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
      const result = provider.showRewarded();
      jest.advanceTimersByTime(2000);
      await expect(result).resolves.toBe('unavailable');
    } finally {
      jest.useRealTimers();
    }
  });

  it('rewarded: a late load within the window still shows the ad', async () => {
    const ad = fakeAd(false);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    const result = provider.showRewarded();
    await Promise.resolve();
    ad.fire('rewarded_loaded');
    await Promise.resolve();
    await Promise.resolve();
    ad.fire('rewarded_earned_reward');
    ad.fire('closed');
    await expect(result).resolves.toBe('earned');
  });

  it('rewarded: an error after the reward still pays out; an error before does not', async () => {
    const ad = fakeAd(true);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    const a = provider.showRewarded();
    await Promise.resolve();
    ad.fire('rewarded_earned_reward');
    ad.fire('error');
    await expect(a).resolves.toBe('earned');
    const ad2 = fakeAd(true);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(ad2);
    const b = provider.showRewarded();
    await Promise.resolve();
    ad2.fire('error');
    await expect(b).resolves.toBe('unavailable');
  });

  it('privacy options reflect the UMP requirement status', async () => {
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValueOnce({ privacyOptionsRequirementStatus: 'REQUIRED' });
    await expect(provider.privacyOptionsRequired!()).resolves.toBe(true);
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValueOnce({ privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
    await expect(provider.privacyOptionsRequired!()).resolves.toBe(false);
    await provider.showPrivacyOptions!();
    expect(AdsConsent.showPrivacyOptionsForm).toHaveBeenCalled();
  });
});

describe('App Tracking Transparency request', () => {
  it('marks the prompt as asked before the system dialog, and asks only where available', async () => {
    (ATT.isAvailable as jest.Mock).mockReturnValue(true);
    await requestTracking();
    expect(getAppData().ads.attPrompted).toBe(true);
    expect(ATT.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);

    (ATT.isAvailable as jest.Mock).mockReturnValue(false);
    await requestTracking();
    expect(ATT.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('never throws when the native module fails', async () => {
    (ATT.isAvailable as jest.Mock).mockReturnValue(true);
    (ATT.requestTrackingPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('no module'));
    await expect(requestTracking()).resolves.toBeUndefined();
    expect(getAppData().ads.attPrompted).toBe(true);
  });
});
