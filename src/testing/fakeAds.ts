import type { AdProvider, RewardedResult } from '../ads/provider';

export interface FakeAds extends AdProvider {
  calls: string[];
  interstitialLoaded: boolean;
  /** What the next rewarded ad does. */
  rewardedResult: RewardedResult;
  consent: boolean;
}

/** Records what the app asked of the ad SDK; nothing is ever shown. */
export function createFakeAds(): FakeAds {
  const ads: FakeAds = {
    calls: [],
    interstitialLoaded: false,
    rewardedResult: 'earned',
    consent: true,
    async init() {
      ads.calls.push('init');
      return ads.consent;
    },
    loadInterstitial() {
      ads.calls.push('loadInterstitial');
      ads.interstitialLoaded = true;
    },
    async showInterstitial() {
      ads.calls.push('showInterstitial');
      const shown = ads.interstitialLoaded;
      ads.interstitialLoaded = false;
      return shown;
    },
    loadRewarded() {
      ads.calls.push('loadRewarded');
    },
    async showRewarded() {
      ads.calls.push('showRewarded');
      return ads.rewardedResult;
    },
  };
  return ads;
}
