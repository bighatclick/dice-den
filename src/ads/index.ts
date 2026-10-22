import { MONETIZATION_ENABLED } from '../config/features';
import { toDateKey } from '../engine/rng';
import type { GameMode } from '../engine/game';
import { getAppData, updateAppData } from '../state/appData';
import { hasRemoveAds } from '../state/shopStore';
import { canShowInterstitial, recordInterstitial, recordRewarded, rewardedLeft, shouldPreloadInterstitial } from './policy';
import { nullAdProvider, type AdProvider, type RewardedResult } from './provider';

let provider: AdProvider | null = null;
let ready: Promise<boolean> | null = null;

function getProvider(): AdProvider {
  // Switched off: no SDK, no consent form, no ads, whatever provider is set.
  if (!MONETIZATION_ENABLED) return nullAdProvider;
  if (provider) return provider;
  try {
    // Loaded lazily so Expo Go and builds without the native module still run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    provider = (require('./admob') as typeof import('./admob')).createAdMobProvider();
  } catch {
    provider = nullAdProvider;
  }
  return provider;
}

/** Tests swap in a fake provider; null goes back to the real one. */
export function setAdProvider(next: AdProvider | null): void {
  provider = next;
  ready = null;
}

/**
 * Gathers consent and starts the SDK once per launch. Called from Home after
 * the first run, never during a game. Never throws.
 */
export function ensureAdsReady(): Promise<boolean> {
  ready ??= getProvider()
    .init()
    .catch(() => false);
  return ready;
}

function context(mode: GameMode) {
  const data = getAppData();
  return { ads: data.ads, stats: data.stats, now: new Date(), removeAds: hasRemoveAds(), mode };
}

/** On the final scorecard: load an interstitial now if one will be allowed when the player leaves. */
export async function prepareInterstitial(mode: GameMode): Promise<void> {
  if (!shouldPreloadInterstitial(context(mode))) return;
  if (await ensureAdsReady()) getProvider().loadInterstitial();
}

/**
 * Leaving the final scorecard (the only interstitial placement). Shows a
 * preloaded ad if every rule allows it and resolves when it closes; resolves
 * at once when not, so navigation is never held up.
 */
export async function interstitialAfterFinal(mode: GameMode, finalShownMs: number): Promise<boolean> {
  if (!canShowInterstitial({ ...context(mode), finalShownMs })) return false;
  if (!(await ensureAdsReady())) return false;
  const shown = await getProvider()
    .showInterstitial()
    .catch(() => false);
  if (shown) updateAppData((d) => ({ ...d, ads: recordInterstitial(d.ads, d.stats.gamesCompleted, new Date()) }));
  return shown;
}

export function rewardedAvailableToday(): number {
  if (!MONETIZATION_ENABLED) return 0;
  return rewardedLeft(getAppData().ads, toDateKey(new Date()));
}

/** Warm up a rewarded ad on a screen that offers one. */
export async function prepareRewarded(): Promise<void> {
  if (rewardedAvailableToday() > 0 && (await ensureAdsReady())) getProvider().loadRewarded();
}

/**
 * Opt-in rewarded ad (24 h cosmetic trial, replay today's dice). Still offered
 * after Remove Ads. Never gives rolls or score help.
 */
export async function watchRewarded(): Promise<RewardedResult> {
  if (rewardedAvailableToday() === 0) return 'unavailable';
  if (!(await ensureAdsReady())) return 'unavailable';
  const result = await getProvider()
    .showRewarded()
    .catch((): RewardedResult => 'unavailable');
  if (result === 'earned') {
    updateAppData((d) => ({ ...d, ads: recordRewarded(d.ads, toDateKey(new Date()), new Date()) }));
  }
  return result;
}

export async function privacyOptionsRequired(): Promise<boolean> {
  const p = getProvider();
  if (!p.privacyOptionsRequired || !(await ensureAdsReady())) return false;
  return p.privacyOptionsRequired().catch(() => false);
}

export async function showPrivacyOptions(): Promise<void> {
  await getProvider()
    .showPrivacyOptions?.()
    .catch(() => undefined);
}
