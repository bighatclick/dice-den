import { DEFAULT_ADS, type AdsState, type Stats } from '../../data/schema';
import {
  activeTrials,
  canShowInterstitial,
  grantTrial,
  interstitialBlock,
  recordInterstitial,
  recordRewarded,
  rewardedLeft,
  shouldOfferAtt,
  shouldPreloadInterstitial,
  shouldShowRemoveAdsCard,
  type InterstitialContext,
} from '../policy';

const NOW = new Date('2026-10-17T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function ctx(change: { ads?: Partial<AdsState>; stats?: Partial<Stats> } & Partial<Omit<InterstitialContext, 'ads' | 'stats'>> = {}): InterstitialContext {
  const { ads, stats, ...rest } = change;
  return {
    ads: { ...DEFAULT_ADS, ...ads },
    stats: { sessions: 2, gamesCompleted: 3, firstLaunchAt: null, ...stats },
    now: NOW,
    removeAds: false,
    mode: 'normal',
    finalShownMs: 5_000,
    ...rest,
  };
}

describe('interstitial after the final scorecard (CLAUDE.md rule 1)', () => {
  it('may show from the 3rd completed game in the 2nd session', () => {
    expect(interstitialBlock(ctx())).toBeNull();
    expect(canShowInterstitial(ctx())).toBe(true);
  });

  it.each([
    ['never in session 1', ctx({ stats: { sessions: 1, gamesCompleted: 9 } }), 'firstSession'],
    ['never before 3 completed games', ctx({ stats: { gamesCompleted: 2 } }), 'tooFewGames'],
    ['never after the daily dice', ctx({ mode: 'daily' }), 'daily'],
    ['never for Remove Ads owners', ctx({ removeAds: true }), 'removeAds'],
    ['never before 3 s on the final scorecard', ctx({ finalShownMs: 2_999 }), 'finalTooShort'],
  ] as const)('%s', (_name, context, reason) => {
    expect(interstitialBlock(context)).toBe(reason);
  });

  it('at most 1 per 2 completed games', () => {
    const shown = { lastInterstitialAt: minutesAgo(30), gamesAtLastInterstitial: 4 };
    expect(interstitialBlock(ctx({ ads: shown, stats: { gamesCompleted: 5 } }))).toBe('gameGap');
    expect(interstitialBlock(ctx({ ads: shown, stats: { gamesCompleted: 6 } }))).toBeNull();
  });

  it('at most 1 per 4 minutes', () => {
    const at = (m: number) => ({ lastInterstitialAt: minutesAgo(m), gamesAtLastInterstitial: 3 });
    expect(interstitialBlock(ctx({ ads: at(3.99), stats: { gamesCompleted: 9 } }))).toBe('tooSoon');
    expect(interstitialBlock(ctx({ ads: at(4), stats: { gamesCompleted: 9 } }))).toBeNull();
  });

  it('preloads while the scorecard is still up, only when an ad will be allowed', () => {
    const { finalShownMs: _ignored, ...base } = ctx({ finalShownMs: 0 });
    expect(shouldPreloadInterstitial(base)).toBe(true);
    expect(shouldPreloadInterstitial({ ...base, removeAds: true })).toBe(false);
    expect(shouldPreloadInterstitial({ ...base, stats: { ...base.stats, gamesCompleted: 2 } })).toBe(false);
  });

  it('recording one starts both gaps', () => {
    const ads = recordInterstitial(DEFAULT_ADS, 3, NOW);
    expect(ads).toMatchObject({ lastInterstitialAt: NOW.toISOString(), gamesAtLastInterstitial: 3, lastAdShownAt: NOW.toISOString() });
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 4 }, now: new Date(NOW.getTime() + 60 * 60_000) }))).toBe('gameGap');
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 5 }, now: new Date(NOW.getTime() + 60_000) }))).toBe('tooSoon');
  });
});

describe('rewarded ads (opt-in, 3 a day)', () => {
  it('counts per calendar day and resets the next day', () => {
    let ads = DEFAULT_ADS;
    expect(rewardedLeft(ads, '2026-10-17')).toBe(3);
    for (let i = 0; i < 3; i++) ads = recordRewarded(ads, '2026-10-17', NOW);
    expect(rewardedLeft(ads, '2026-10-17')).toBe(0);
    expect(rewardedLeft(recordRewarded(ads, '2026-10-17', NOW), '2026-10-17')).toBe(0);
    expect(rewardedLeft(ads, '2026-10-18')).toBe(3);
    expect(recordRewarded(ads, '2026-10-18', NOW).rewarded).toEqual({ date: '2026-10-18', count: 1 });
    expect(ads.lastAdShownAt).toBe(NOW.toISOString());
  });

  it('a trial lasts 24 hours', () => {
    const ads = grantTrial(DEFAULT_ADS, 'marble', NOW);
    expect(activeTrials(ads, new Date(NOW.getTime() + 23 * 3_600_000))).toEqual(['marble']);
    expect(activeTrials(ads, new Date(NOW.getTime() + 24 * 3_600_000))).toEqual([]);
  });
});

describe('ATT soft prompt', () => {
  const base = { ads: DEFAULT_ADS, stats: { sessions: 4, gamesCompleted: 0, firstLaunchAt: null }, platform: 'ios', inGame: false };

  it('comes only after the 3rd session, on iOS, outside a game, once', () => {
    expect(shouldOfferAtt(base)).toBe(true);
    expect(shouldOfferAtt({ ...base, stats: { ...base.stats, sessions: 3 } })).toBe(false);
    expect(shouldOfferAtt({ ...base, platform: 'android' })).toBe(false);
    expect(shouldOfferAtt({ ...base, inGame: true })).toBe(false);
    expect(shouldOfferAtt({ ...base, ads: { ...DEFAULT_ADS, attPrompted: true } })).toBe(false);
  });
});

describe('Remove Ads card on the final scorecard', () => {
  const base = { ads: DEFAULT_ADS, stats: { sessions: 2, gamesCompleted: 3, firstLaunchAt: null }, removeAds: false, mode: 'normal' as const };

  it('shows once from game 3, never to owners or in the daily dice', () => {
    expect(shouldShowRemoveAdsCard(base)).toBe(true);
    expect(shouldShowRemoveAdsCard({ ...base, stats: { ...base.stats, gamesCompleted: 2 } })).toBe(false);
    expect(shouldShowRemoveAdsCard({ ...base, removeAds: true })).toBe(false);
    expect(shouldShowRemoveAdsCard({ ...base, mode: 'daily' })).toBe(false);
    expect(shouldShowRemoveAdsCard({ ...base, ads: { ...DEFAULT_ADS, removeAdsCardShown: true } })).toBe(false);
  });
});
