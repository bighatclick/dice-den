import '../i18n/i18n';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Platform } from 'react-native';
import DailyScreen from '../../app/daily';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import SettingsScreen from '../../app/settings';
import ShopScreen from '../../app/shop';
import { setAdProvider } from '../ads';
import { MIN_FINAL_SCREEN_MS } from '../ads/policy';
import { toDateKey } from '../engine/rng';
import { CLASSIC } from '../engine/rules/presets';
import { setPurchaseStore } from '../iap';
import { createFakeStore, type FakeStore } from '../iap/fakeStore';
import { PRODUCT_IDS } from '../iap/products';
import { getAppData, updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { resetShopStore } from '../state/shopStore';
import { createFakeAds, type FakeAds } from '../testing/fakeAds';
import { scriptDice, setUpAppData } from '../testing/appData';

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen, daily: DailyScreen, shop: ShopScreen, settings: SettingsScreen };

let store: FakeStore;
let ads: FakeAds;

beforeEach(() => {
  setUpAppData();
  resetShopStore();
  store = createFakeStore();
  setPurchaseStore(store);
  ads = createFakeAds();
  setAdProvider(ads);
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Moves the scorecard's clock. Only Date.now moves: advancing Jest's fake
 * timers (which renderRouter turns on) would also fire the navigator's own timers.
 */
function advanceClock(ms: number) {
  const now = Date.now() + ms;
  jest.spyOn(Date, 'now').mockReturnValue(now);
}

async function pressNode(node: Parameters<typeof fireEvent.press>[0]) {
  await fireEvent.press(node);
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

/** Presses and lets the async leave (ad, then navigation) run to the end inside act. */
async function pressAndSettle(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

function finishSoloGame() {
  scriptDice([4, 4, 4, 4, 4]);
  const { start, roll, score } = useGameStore.getState();
  start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
  for (const box of CLASSIC.boxes) {
    roll();
    score(box);
  }
}

describe('Shop (S9)', () => {
  it('shows store prices, one-time purchase wording and Restore', async () => {
    await renderRouter(routes, { initialUrl: '/shop' });
    expect(await screen.findByRole('button', { name: 'Buy Remove Ads for $3.99, one-time purchase' })).toBeTruthy();
    expect(screen.getByText('Buy for $3.99')).toBeTruthy();
    expect(screen.getAllByText('One-time purchase').length).toBe(5);
    expect(screen.getByRole('button', { name: 'Restore Purchases' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Terms of use' })).toBeTruthy();
  });

  it('buys a pack and the skins can be used', async () => {
    await renderRouter(routes, { initialUrl: '/shop' });
    const buy = await screen.findByRole('button', { name: 'Buy Classic Dice Pack for $1.99, one-time purchase' });
    expect(screen.getByTestId('cosmetic-dice-marble').props.accessibilityState.disabled).toBe(true);
    await pressNode(buy);
    expect(await screen.findByText("Thank you! It's yours.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId('cosmetic-dice-marble'));
    expect(useSettingsStore.getState().settings.diceSkin).toBe('marble');
    expect(screen.getByTestId('cosmetic-dice-marble').props.accessibilityState.selected).toBe(true);
  });

  it('tells the player when the store is unavailable, and the picker still works', async () => {
    store.available = false;
    await renderRouter(routes, { initialUrl: '/shop' });
    expect(await screen.findByText("The store isn't available right now. Your dice and tables still work.")).toBeTruthy();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('cosmetic-dice-walnut'));
    expect(useSettingsStore.getState().settings.diceSkin).toBe('walnut');
  });

  it('a rewarded ad unlocks a skin for 24 hours', async () => {
    await renderRouter(routes, { initialUrl: '/shop' });
    await pressNode(await screen.findByTestId('trial-dice-glass'));
    expect(ads.calls).toContain('showRewarded');
    expect(useSettingsStore.getState().settings.diceSkin).toBe('glass');
    expect(Object.keys(getAppData().ads.trials)).toEqual(['dice:glass']);
    expect(screen.queryByTestId('trial-dice-glass')).toBeNull();
  });

  // Regression: the "no ad" note went to the top of the Shop, out of sight of the button far below.
  it('says right under the button when no ad is available', async () => {
    ads.rewardedResult = 'unavailable';
    await renderRouter(routes, { initialUrl: '/shop' });
    await pressNode(await screen.findByTestId('trial-dice-glass'));
    expect(screen.queryByTestId('shop-notice')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('No ad is available right now. Try again later.');
    expect(useSettingsStore.getState().settings.diceSkin).not.toBe('glass');
  });

  it('earned skins say how to earn them and have no trial', async () => {
    await renderRouter(routes, { initialUrl: '/shop' });
    expect(await screen.findByRole('button', { name: 'Amber, Finish 10 games' })).toBeTruthy();
    expect(screen.queryByTestId('trial-dice-amber')).toBeNull();
  });

  it('owned products show as owned, not for sale', async () => {
    store.ownedIds.add(PRODUCT_IDS.supporter);
    await renderRouter(routes, { initialUrl: '/shop' });
    await waitFor(() => expect(screen.getAllByText('Owned').length).toBe(4));
    expect(screen.queryByTestId('buy-removeAds')).toBeNull();
    expect(screen.queryByText('Complete Collection')).toBeNull();
  });
});

describe('Settings purchases', () => {
  it('restores purchases and then shows ads as removed', async () => {
    store.ownedIds.add(PRODUCT_IDS.removeAds);
    await renderRouter(routes, { initialUrl: '/settings' });
    await pressNode(screen.getByRole('link', { name: 'Restore Purchases' }));
    expect(await screen.findByText('Your purchases are restored.')).toBeTruthy();
    expect(screen.getByText('Ads removed')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Remove Ads' })).toBeNull();
  });
});

describe('Ads around the final scorecard', () => {
  function adsAllowed() {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 2, gamesCompleted: 4 } }));
  }

  it('shows an interstitial only after leaving, and only after 3 s on the scorecard', async () => {
    adsAllowed();
    finishSoloGame();
    const router = await renderRouter(routes, { initialUrl: '/final' });
    await act(async () => undefined);
    expect(ads.calls).toEqual(['init', 'loadInterstitial']);
    advanceClock(MIN_FINAL_SCREEN_MS);
    await pressAndSettle('Home');
    expect(router.getPathname()).toBe('/');
    expect(ads.calls).toContain('showInterstitial');
    expect(getAppData().ads.gamesAtLastInterstitial).toBe(5);
  });

  it('leaving at once shows nothing and still navigates', async () => {
    adsAllowed();
    finishSoloGame();
    const router = await renderRouter(routes, { initialUrl: '/final' });
    await pressAndSettle('Home');
    expect(router.getPathname()).toBe('/');
    expect(ads.calls).not.toContain('showInterstitial');
  });

  it('Remove Ads hides interstitials', async () => {
    adsAllowed();
    updateAppData((d) => ({ ...d, purchasesCache: { productIds: [PRODUCT_IDS.removeAds], updatedAt: null } }));
    finishSoloGame();
    const router = await renderRouter(routes, { initialUrl: '/final' });
    advanceClock(10_000);
    await pressAndSettle('Home');
    expect(router.getPathname()).toBe('/');
    expect(ads.calls.filter((c) => c.includes('Interstitial'))).toEqual([]);
    expect(screen.queryByTestId('remove-ads-card')).toBeNull();
  });

  it('shows the Remove Ads card once, from game 3', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 2 } }));
    finishSoloGame();
    await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByTestId('remove-ads-card')).toBeTruthy();
    expect(getAppData().ads.removeAdsCardShown).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'See Remove Ads' }));
  });

  it('announces a skin earned at 10 games', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 9 } }));
    finishSoloGame();
    await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByText('New dice unlocked: Amber')).toBeTruthy();
    expect(getAppData().unlocks.dice).toContain('amber');
  });
});

describe('Daily replay', () => {
  it('a finished day can be replayed after a rewarded ad; the first score stays', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, lastCompleted: today, streak: 1, bestStreak: 1, results: { [today]: 201 } } }));
    const router = await renderRouter(routes, { initialUrl: '/daily' });
    await pressNode(within(screen.getByTestId('daily-replay')).getByRole('button'));
    expect(ads.calls).toContain('showRewarded');
    expect(router.getPathname()).toBe('/game');
    expect(useGameStore.getState().game?.id).toBe(`daily-${today}-r1`);
    expect(getAppData().daily.results[today]).toBe(201);
  });

  it('no ad, no replay', async () => {
    ads.rewardedResult = 'unavailable';
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { [today]: 150 } } }));
    const router = await renderRouter(routes, { initialUrl: '/daily' });
    await pressNode(within(screen.getByTestId('daily-replay')).getByRole('button'));
    expect(router.getPathname()).toBe('/daily');
    expect(screen.getByText('No ad is available right now. Try again later.')).toBeTruthy();
  });
});

describe('ATT soft prompt', () => {
  it('appears on Home after the 3rd session on iOS, once', async () => {
    expect(Platform.OS).toBe('ios');
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 4 } }));
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('About the ads')).toBeTruthy();
    expect(ads.calls).toEqual([]);
    await pressNode(screen.getByRole('button', { name: 'Continue' }));
    expect(getAppData().ads.attPrompted).toBe(true);
    expect(ads.calls).toEqual(['init']);
  });

  it('does not appear before then', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 3 } }));
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.queryByText('About the ads')).toBeNull();
  });
});
