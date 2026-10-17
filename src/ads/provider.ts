export type RewardedResult = 'earned' | 'dismissed' | 'unavailable';

/**
 * What the app needs from an ad SDK. The AdMob version is in admob.ts; Jest
 * and builds without the native module use a fake or the null provider.
 * Every method resolves within about 2 s when nothing can be shown.
 */
export interface AdProvider {
  /** UMP consent (EEA/UK) first, then SDK start. False when ads may not be requested. */
  init(): Promise<boolean>;
  loadInterstitial(): void;
  /** Shows a loaded interstitial; resolves when it closes. False if none was ready. */
  showInterstitial(): Promise<boolean>;
  loadRewarded(): void;
  /** Shows a rewarded ad, waiting up to 2 s for it to load. */
  showRewarded(): Promise<RewardedResult>;
  /** Shows Google's privacy options form when the region requires one. */
  showPrivacyOptions?(): Promise<void>;
  privacyOptionsRequired?(): Promise<boolean>;
}

export const nullAdProvider: AdProvider = {
  init: async () => false,
  loadInterstitial: () => undefined,
  showInterstitial: async () => false,
  loadRewarded: () => undefined,
  showRewarded: async () => 'unavailable',
};
