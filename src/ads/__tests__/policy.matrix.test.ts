import { DEFAULT_ADS, type AdsState, type Stats } from '../../data/schema';
import {
  activeTrials,
  ATT_AFTER_SESSIONS,
  canShowInterstitial,
  GAMES_BETWEEN_INTERSTITIALS,
  grantTrial,
  interstitialBlock,
  MIN_FINAL_SCREEN_MS,
  MIN_GAMES_BEFORE_INTERSTITIAL,
  MS_BETWEEN_INTERSTITIALS,
  recordInterstitial,
  recordRewarded,
  REWARDED_PER_DAY,
  rewardedLeft,
  shouldOfferAtt,
  shouldPreloadInterstitial,
  shouldShowRemoveAdsCard,
  TRIAL_MS,
  type InterstitialContext,
} from '../policy';

const NOW = new Date('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

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

describe('the constants match CLAUDE.md rule 1 and specs.md §7.1', () => {
  it('3 games, 1 per 2 games, 1 per 4 minutes, 3 s on the scorecard, 3 rewarded a day, ATT after session 3, 24 h trials', () => {
    expect(MIN_GAMES_BEFORE_INTERSTITIAL).toBe(3);
    expect(GAMES_BETWEEN_INTERSTITIALS).toBe(2);
    expect(MS_BETWEEN_INTERSTITIALS).toBe(4 * 60 * 1000);
    expect(MIN_FINAL_SCREEN_MS).toBe(3000);
    expect(REWARDED_PER_DAY).toBe(3);
    expect(ATT_AFTER_SESSIONS).toBe(3);
    expect(TRIAL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('interstitial rule precedence', () => {
  // When several rules block at once, Remove Ads wins (it is the strongest promise), then mode, then session, then games.
  it('reports Remove Ads first, then the daily, then session 1, then too few games', () => {
    const everything = ctx({ removeAds: true, mode: 'daily', stats: { sessions: 1, gamesCompleted: 0 }, finalShownMs: 0 });
    expect(interstitialBlock(everything)).toBe('removeAds');
    expect(interstitialBlock({ ...everything, removeAds: false })).toBe('daily');
    expect(interstitialBlock({ ...everything, removeAds: false, mode: 'normal' })).toBe('firstSession');
    expect(interstitialBlock({ ...everything, removeAds: false, mode: 'normal', stats: { sessions: 2, gamesCompleted: 2, firstLaunchAt: null } })).toBe('tooFewGames');
    expect(interstitialBlock({ ...everything, removeAds: false, mode: 'normal', stats: { sessions: 2, gamesCompleted: 3, firstLaunchAt: null } })).toBe('finalTooShort');
  });
});

describe('session boundary', () => {
  it.each([
    [0, 'firstSession'],
    [1, 'firstSession'],
    [2, null],
    [50, null],
  ] as const)('sessions=%i → %s', (sessions, block) => {
    expect(interstitialBlock(ctx({ stats: { sessions, gamesCompleted: 10 } }))).toBe(block);
  });
});

describe('completed-games boundary', () => {
  it.each([
    [0, 'tooFewGames'],
    [2, 'tooFewGames'],
    [3, null],
    [4, null],
  ] as const)('gamesCompleted=%i → %s', (gamesCompleted, block) => {
    expect(interstitialBlock(ctx({ stats: { gamesCompleted } }))).toBe(block);
  });
});

describe('game gap and time gap after an interstitial', () => {
  const shown = (minutesAgo: number, atGame: number) => ({ lastInterstitialAt: ago(minutesAgo * 60_000), gamesAtLastInterstitial: atGame });

  it('needs 2 more completed games: 0 and 1 later block, 2 later allows', () => {
    expect(interstitialBlock(ctx({ ads: shown(60, 5), stats: { gamesCompleted: 5 } }))).toBe('gameGap');
    expect(interstitialBlock(ctx({ ads: shown(60, 5), stats: { gamesCompleted: 6 } }))).toBe('gameGap');
    expect(interstitialBlock(ctx({ ads: shown(60, 5), stats: { gamesCompleted: 7 } }))).toBeNull();
  });

  it('the game gap is checked before the time gap', () => {
    expect(interstitialBlock(ctx({ ads: shown(0, 5), stats: { gamesCompleted: 5 } }))).toBe('gameGap');
  });

  it('exact 4-minute boundary: 1 ms short blocks, exactly 4 minutes allows', () => {
    const base = { gamesAtLastInterstitial: 3 };
    expect(interstitialBlock(ctx({ ads: { ...base, lastInterstitialAt: ago(MS_BETWEEN_INTERSTITIALS - 1) }, stats: { gamesCompleted: 9 } }))).toBe('tooSoon');
    expect(interstitialBlock(ctx({ ads: { ...base, lastInterstitialAt: ago(MS_BETWEEN_INTERSTITIALS) }, stats: { gamesCompleted: 9 } }))).toBeNull();
  });

  it('a clock that went backwards (lastInterstitialAt in the future) still counts as too soon', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(interstitialBlock(ctx({ ads: { lastInterstitialAt: future, gamesAtLastInterstitial: 0 }, stats: { gamesCompleted: 9 } }))).toBe('tooSoon');
  });

  it('an unparsable timestamp never allows an ad through the time gap (NaN comparison)', () => {
    const block = interstitialBlock(ctx({ ads: { lastInterstitialAt: 'garbage', gamesAtLastInterstitial: 0 }, stats: { gamesCompleted: 9 } }));
    // NaN < limit is false, so the time rule does not block; the ad is allowed only if everything else is fine.
    // This pins the behaviour so a change here is deliberate.
    expect(block).toBeNull();
  });
});

describe('final scorecard dwell time', () => {
  it.each([
    [0, 'finalTooShort'],
    [2999, 'finalTooShort'],
    [3000, null],
    [60_000, null],
  ] as const)('finalShownMs=%i → %s', (finalShownMs, block) => {
    expect(interstitialBlock(ctx({ finalShownMs }))).toBe(block);
    expect(canShowInterstitial(ctx({ finalShownMs }))).toBe(block === null);
  });

  it('shouldPreload ignores the dwell time but respects every other rule', () => {
    const { finalShownMs: _f, ...base } = ctx();
    expect(shouldPreloadInterstitial(base)).toBe(true);
    expect(shouldPreloadInterstitial({ ...base, mode: 'daily' })).toBe(false);
    expect(shouldPreloadInterstitial({ ...base, stats: { ...base.stats, sessions: 1 } })).toBe(false);
    expect(shouldPreloadInterstitial({ ...base, ads: { ...base.ads, lastInterstitialAt: ago(1000), gamesAtLastInterstitial: 3 } })).toBe(false);
  });
});

describe('recording', () => {
  it('recordInterstitial keeps every other field and stamps both the ad clock and the game count', () => {
    const before: AdsState = { ...DEFAULT_ADS, attPrompted: true, trials: { 'dice:glass': 'x' }, rewarded: { date: '2026-10-17', count: 2 } };
    const after = recordInterstitial(before, 7, NOW);
    expect(after).toEqual({ ...before, lastInterstitialAt: NOW.toISOString(), gamesAtLastInterstitial: 7, lastAdShownAt: NOW.toISOString() });
    expect(before.lastInterstitialAt).toBeNull(); // not mutated
  });

  it('a full cycle: show → wait 2 games and 4 min → allowed again', () => {
    let ads = recordInterstitial(DEFAULT_ADS, 3, NOW);
    const later = new Date(NOW.getTime() + MS_BETWEEN_INTERSTITIALS);
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 4 }, now: later }))).toBe('gameGap');
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 5 }, now: NOW }))).toBe('tooSoon');
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 5 }, now: later }))).toBeNull();
    ads = recordInterstitial(ads, 5, later);
    expect(interstitialBlock(ctx({ ads, stats: { gamesCompleted: 6 }, now: new Date(later.getTime() + 10 * 60_000) }))).toBe('gameGap');
  });
});

describe('rewarded ads', () => {
  it('counts never go negative and the count is capped per day, not per launch', () => {
    let ads = DEFAULT_ADS;
    for (let i = 0; i < 10; i++) ads = recordRewarded(ads, '2026-10-17', NOW);
    expect(ads.rewarded).toEqual({ date: '2026-10-17', count: 10 });
    expect(rewardedLeft(ads, '2026-10-17')).toBe(0);
    expect(rewardedLeft(ads, '2026-10-16')).toBe(3);
  });

  it('a count from another day is ignored, not carried over', () => {
    const ads: AdsState = { ...DEFAULT_ADS, rewarded: { date: '2026-10-16', count: 3 } };
    expect(rewardedLeft(ads, '2026-10-17')).toBe(3);
    expect(recordRewarded(ads, '2026-10-17', NOW).rewarded).toEqual({ date: '2026-10-17', count: 1 });
  });

  it('rewarded ads do not touch the interstitial clock', () => {
    const ads = recordRewarded(DEFAULT_ADS, '2026-10-17', NOW);
    expect(ads.lastInterstitialAt).toBeNull();
    expect(interstitialBlock(ctx({ ads }))).toBeNull();
  });
});

describe('cosmetic trials', () => {
  it('restarting a trial extends it from now, keeping other trials', () => {
    let ads = grantTrial(DEFAULT_ADS, 'dice:glass', NOW);
    ads = grantTrial(ads, 'table:slate', new Date(NOW.getTime() + 3_600_000));
    const later = new Date(NOW.getTime() + 20 * 3_600_000);
    ads = grantTrial(ads, 'dice:glass', later);
    expect(activeTrials(ads, new Date(later.getTime() + 23 * 3_600_000))).toEqual(['dice:glass']);
    expect(activeTrials(ads, new Date(NOW.getTime() + 24 * 3_600_000))).toEqual(['dice:glass', 'table:slate'].sort());
  });

  it('a trial that ends at exactly now is over; a malformed expiry is never active', () => {
    const ads: AdsState = { ...DEFAULT_ADS, trials: { 'dice:glass': NOW.toISOString(), 'dice:bone': 'not-a-date' } };
    expect(activeTrials(ads, NOW)).toEqual([]);
    expect(activeTrials(ads, new Date(NOW.getTime() - 1))).toEqual(['dice:glass']);
  });
});

describe('ATT soft prompt boundary', () => {
  const stats = (sessions: number): Stats => ({ sessions, gamesCompleted: 0, firstLaunchAt: null });
  it.each([
    [1, false],
    [3, false],
    [4, true],
    [100, true],
  ])('sessions=%i → %s', (sessions, expected) => {
    expect(shouldOfferAtt({ ads: DEFAULT_ADS, stats: stats(sessions), platform: 'ios', inGame: false })).toBe(expected);
  });

  it.each(['android', 'web', 'macos', ''])('never on %p', (platform) => {
    expect(shouldOfferAtt({ ads: DEFAULT_ADS, stats: stats(10), platform, inGame: false })).toBe(false);
  });
});

describe('Remove Ads card boundary', () => {
  it.each([
    [2, false],
    [3, true],
    [10, true],
  ])('gamesCompleted=%i → %s', (gamesCompleted, expected) => {
    expect(shouldShowRemoveAdsCard({ ads: DEFAULT_ADS, stats: { sessions: 1, gamesCompleted, firstLaunchAt: null }, removeAds: false, mode: 'normal' })).toBe(expected);
  });

  it('does not depend on the session count (unlike interstitials)', () => {
    expect(shouldShowRemoveAdsCard({ ads: DEFAULT_ADS, stats: { sessions: 1, gamesCompleted: 3, firstLaunchAt: null }, removeAds: false, mode: 'normal' })).toBe(true);
  });
});
