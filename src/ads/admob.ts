import { Platform } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { SDK_TIMEOUT_MS, withTimeout } from '../util/timeout';
import type { AdProvider, RewardedResult } from './provider';

/**
 * Ad unit ids. Development builds always use Google's test units. A release
 * build without real ids set shows no ads at all rather than test ads.
 */
function unitId(kind: 'interstitial' | 'rewarded'): string | null {
  if (__DEV__) return kind === 'interstitial' ? TestIds.INTERSTITIAL : TestIds.REWARDED;
  const env = {
    interstitial: Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
    rewarded: Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
  };
  return env[kind] || null;
}

/** Resolves once, however many of the listeners fire. */
function once<T>(resolve: (value: T) => void, cleanup: () => void): (value: T) => void {
  let done = false;
  return (value) => {
    if (done) return;
    done = true;
    cleanup();
    resolve(value);
  };
}

export function createAdMobProvider(): AdProvider {
  let interstitial: InterstitialAd | null = null;
  let rewarded: RewardedAd | null = null;

  return {
    async init() {
      // UMP decides whether ads may be requested at all (EEA/UK need consent first).
      // EXPO_PUBLIC_UMP_DEBUG_EEA=1 makes a development build act as if in the EEA,
      // so the consent form can be checked on an emulator (emulators are test devices).
      const debugEea = __DEV__ && process.env.EXPO_PUBLIC_UMP_DEBUG_EEA === '1';
      const consent = await AdsConsent.gatherConsent(debugEea ? { debugGeography: AdsConsentDebugGeography.EEA } : undefined);
      if (!consent.canRequestAds) return false;
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.G });
      await mobileAds().initialize();
      // specs.md F12: every ad is muted.
      mobileAds().setAppMuted(true);
      mobileAds().setAppVolume(0);
      return true;
    },

    loadInterstitial() {
      const id = unitId('interstitial');
      if (!id || interstitial) return;
      const ad = InterstitialAd.createForAdRequest(id);
      ad.addAdEventListener(AdEventType.ERROR, () => {
        if (interstitial === ad) interstitial = null;
      });
      interstitial = ad;
      ad.load();
    },

    showInterstitial() {
      const ad = interstitial;
      if (!ad?.loaded) return Promise.resolve(false);
      interstitial = null;
      return new Promise<boolean>((resolve) => {
        let opened = false;
        const off: (() => void)[] = [];
        const finish = once(resolve, () => {
          clearTimeout(timer);
          off.forEach((f) => f());
        });
        // Nothing on screen within 2 s: carry on without the ad (CLAUDE.md rule 9).
        const timer = setTimeout(() => finish(false), SDK_TIMEOUT_MS);
        off.push(
          ad.addAdEventListener(AdEventType.OPENED, () => {
            opened = true;
            clearTimeout(timer);
          }),
          ad.addAdEventListener(AdEventType.CLOSED, () => finish(true)),
          ad.addAdEventListener(AdEventType.ERROR, () => finish(opened)),
        );
        ad.show().catch(() => finish(false));
      });
    },

    loadRewarded() {
      const id = unitId('rewarded');
      if (!id || rewarded) return;
      const ad = RewardedAd.createForAdRequest(id);
      ad.addAdEventListener(AdEventType.ERROR, () => {
        if (rewarded === ad) rewarded = null;
      });
      rewarded = ad;
      ad.load();
    },

    async showRewarded() {
      this.loadRewarded();
      const ad = rewarded;
      if (!ad) return 'unavailable';
      if (!ad.loaded) {
        const loaded = await withTimeout(
          new Promise<boolean>((resolve) => {
            const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
              offLoaded();
              resolve(true);
            });
          }),
          SDK_TIMEOUT_MS,
          false,
        );
        if (!loaded) return 'unavailable';
      }
      rewarded = null;
      return new Promise<RewardedResult>((resolve) => {
        let earned = false;
        const off: (() => void)[] = [];
        const finish = once(resolve, () => off.forEach((f) => f()));
        off.push(
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          }),
          ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? 'earned' : 'dismissed')),
          ad.addAdEventListener(AdEventType.ERROR, () => finish(earned ? 'earned' : 'unavailable')),
        );
        ad.show().catch(() => finish('unavailable'));
      });
    },

    async privacyOptionsRequired() {
      const info = await AdsConsent.getConsentInfo();
      return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    },

    async showPrivacyOptions() {
      await AdsConsent.showPrivacyOptionsForm();
    },
  };
}
