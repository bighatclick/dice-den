import type { AdsState, Stats } from '../data/schema';
import type { GameMode } from '../engine/game';

/**
 * Every ad timing rule lives here (CLAUDE.md rule 1, specs.md §7.1). Pure and
 * unit-tested: the screens only ask "may I?" and report what happened.
 */

/** No interstitial before this many completed games. */
export const MIN_GAMES_BEFORE_INTERSTITIAL = 3;
/** At most 1 interstitial per this many completed games. */
export const GAMES_BETWEEN_INTERSTITIALS = 2;
/** At most 1 interstitial per 4 minutes. */
export const MS_BETWEEN_INTERSTITIALS = 4 * 60_000;
/** The final scorecard stays up at least 3 s before an interstitial may follow it. */
export const MIN_FINAL_SCREEN_MS = 3_000;
/** Rewarded ads are opt-in and capped at 3 a day. */
export const REWARDED_PER_DAY = 3;
/** The ATT soft prompt comes only after the 3rd session. */
export const ATT_AFTER_SESSIONS = 3;
/** A rewarded cosmetic trial lasts 24 hours. */
export const TRIAL_MS = 24 * 60 * 60_000;

export type InterstitialBlock =
  | 'removeAds'
  | 'daily'
  | 'firstSession'
  | 'tooFewGames'
  | 'gameGap'
  | 'tooSoon'
  | 'finalTooShort';

export interface InterstitialContext {
  ads: AdsState;
  stats: Stats;
  now: Date;
  removeAds: boolean;
  /** Mode of the game whose final scorecard is being left. */
  mode: GameMode;
  /** How long the final scorecard has been on screen. */
  finalShownMs: number;
}

/**
 * Why an interstitial may not show after leaving the final scorecard, or null
 * when it may. The caller has already checked that the player is leaving S5
 * (the only placement); every other screen simply never asks.
 */
export function interstitialBlock(ctx: InterstitialContext): InterstitialBlock | null {
  const { ads, stats, now } = ctx;
  if (ctx.removeAds) return 'removeAds';
  if (ctx.mode === 'daily') return 'daily';
  if (stats.sessions <= 1) return 'firstSession';
  if (stats.gamesCompleted < MIN_GAMES_BEFORE_INTERSTITIAL) return 'tooFewGames';
  if (ads.lastInterstitialAt !== null) {
    if (stats.gamesCompleted - ads.gamesAtLastInterstitial < GAMES_BETWEEN_INTERSTITIALS) return 'gameGap';
    if (now.getTime() - Date.parse(ads.lastInterstitialAt) < MS_BETWEEN_INTERSTITIALS) return 'tooSoon';
  }
  if (ctx.finalShownMs < MIN_FINAL_SCREEN_MS) return 'finalTooShort';
  return null;
}

export function canShowInterstitial(ctx: InterstitialContext): boolean {
  return interstitialBlock(ctx) === null;
}

/**
 * Worth loading an interstitial now? True when the only thing missing is time
 * on the final scorecard, so the ad is ready by the time the player leaves.
 */
export function shouldPreloadInterstitial(ctx: Omit<InterstitialContext, 'finalShownMs'>): boolean {
  return interstitialBlock({ ...ctx, finalShownMs: MIN_FINAL_SCREEN_MS }) === null;
}

export function recordInterstitial(ads: AdsState, gamesCompleted: number, now: Date): AdsState {
  const at = now.toISOString();
  return { ...ads, lastInterstitialAt: at, gamesAtLastInterstitial: gamesCompleted, lastAdShownAt: at };
}

/** Rewarded ads left today (`today` is a YYYY-MM-DD key). Remove Ads does not change this. */
export function rewardedLeft(ads: AdsState, today: string): number {
  const used = ads.rewarded.date === today ? ads.rewarded.count : 0;
  return Math.max(0, REWARDED_PER_DAY - used);
}

export function recordRewarded(ads: AdsState, today: string, now: Date): AdsState {
  const count = ads.rewarded.date === today ? ads.rewarded.count + 1 : 1;
  return { ...ads, rewarded: { date: today, count }, lastAdShownAt: now.toISOString() };
}

/** Starts (or restarts) a 24 h trial of a dice skin or table earned with a rewarded ad. */
export function grantTrial(ads: AdsState, cosmeticId: string, now: Date): AdsState {
  return { ...ads, trials: { ...ads.trials, [cosmeticId]: new Date(now.getTime() + TRIAL_MS).toISOString() } };
}

/** Cosmetic ids whose trial is still running. */
export function activeTrials(ads: AdsState, now: Date): string[] {
  return Object.entries(ads.trials)
    .filter(([, until]) => Date.parse(until) > now.getTime())
    .map(([id]) => id);
}

/**
 * The ATT soft prompt: iOS only, once, after the 3rd session and never during a
 * game. Declining it just means non-personalised ads.
 */
export function shouldOfferAtt(input: { ads: AdsState; stats: Stats; platform: string; inGame: boolean }): boolean {
  return input.platform === 'ios' && !input.ads.attPrompted && input.stats.sessions > ATT_AFTER_SESSIONS && !input.inGame;
}

/**
 * The small Remove Ads card on the final scorecard (specs.md §7.2): once, from
 * game 3 on, never for owners and never in the daily dice.
 */
export function shouldShowRemoveAdsCard(input: { ads: AdsState; stats: Stats; removeAds: boolean; mode: GameMode }): boolean {
  return (
    !input.removeAds &&
    !input.ads.removeAdsCardShown &&
    input.mode !== 'daily' &&
    input.stats.gamesCompleted >= MIN_GAMES_BEFORE_INTERSTITIAL
  );
}
