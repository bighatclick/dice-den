import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import DailyScreen from '../../app/daily';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HelpScreen from '../../app/help';
import HomeScreen from '../../app/index';
import SettingsScreen from '../../app/settings';
import ShopScreen from '../../app/shop';
import { setAdProvider } from '../ads';
import { MIN_FINAL_SCREEN_MS } from '../ads/policy';
import { toDateKey } from '../engine/rng';
import { CLASSIC } from '../engine/rules/presets';
import { setPurchaseStore } from '../iap';
import { createFakeStore, type FakeStore } from '../iap/fakeStore';
import { updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { resetShopStore } from '../state/shopStore';
import { createFakeAds, type FakeAds } from '../testing/fakeAds';
import { scriptDice, setUpAppData } from '../testing/appData';

// The switch as builds ship it for now: ads and purchases off.
jest.mock('../config/features', () => ({ MONETIZATION_ENABLED: false }));

const routes = {
  index: HomeScreen,
  game: GameScreen,
  final: FinalScreen,
  daily: DailyScreen,
  shop: ShopScreen,
  settings: SettingsScreen,
  help: HelpScreen,
};

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

async function settle() {
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

describe('Ads and purchases switched off', () => {
  it('Home has no Shop and never shows the tracking prompt or starts ads', async () => {
    // Late enough for the tracking prompt and ads if they were on.
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 6, gamesCompleted: 8 } }));
    await renderRouter(routes, { initialUrl: '/' });
    await settle();
    expect(screen.queryByRole('button', { name: 'Shop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'How to play' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByText('About the ads')).toBeNull();
    expect(ads.calls).toEqual([]);
    expect(store.calls).toEqual([]);
  });

  it('a finished game shows no Remove Ads card and no ad when leaving', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 6, gamesCompleted: 8 } }));
    finishSoloGame();
    const router = await renderRouter(routes, { initialUrl: '/final' });
    await settle();
    expect(screen.queryByTestId('remove-ads-card')).toBeNull();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + MIN_FINAL_SCREEN_MS);
    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(router.getPathname()).toBe('/');
    expect(ads.calls).toEqual([]);
  });

  it("today's dice offer no ad replay once played", async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, lastCompleted: today, streak: 1, bestStreak: 1, results: { [today]: 201 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    await settle();
    expect(screen.queryByTestId('daily-replay')).toBeNull();
    expect(screen.queryByText(/No more replays/)).toBeNull();
    expect(screen.getByText('New dice tomorrow.')).toBeTruthy();
    expect(ads.calls).toEqual([]);
  });

  it('Settings has no purchases section but still opens Dice and tables', async () => {
    const router = await renderRouter(routes, { initialUrl: '/settings' });
    await settle();
    expect(screen.queryByText('Remove Ads')).toBeNull();
    expect(screen.queryByText('Restore Purchases')).toBeNull();
    expect(screen.queryByText('Ad privacy choices')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Dice and tables' }));
    expect(router.getPathname()).toBe('/shop');
  });

  it('Dice and tables shows free and earned styles only, with nothing to buy or try', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 10 }, unlocks: { ...d.unlocks, dice: ['amber'] } }));
    await renderRouter(routes, { initialUrl: '/shop' });
    await settle();
    expect(screen.getByRole('header', { name: 'Dice and tables' })).toBeTruthy();
    // Free, earned and still-to-earn styles stay.
    expect(screen.getByTestId('cosmetic-dice-ivory')).toBeTruthy();
    expect(screen.getByTestId('cosmetic-dice-amber')).toBeTruthy();
    expect(screen.getByTestId('cosmetic-dice-jade')).toBeTruthy();
    expect(screen.getByTestId('cosmetic-table-felt')).toBeTruthy();
    // Pack-only styles, prices, trials and Restore are gone.
    expect(screen.queryByTestId('cosmetic-dice-bone')).toBeNull();
    expect(screen.queryByTestId('cosmetic-table-slate')).toBeNull();
    expect(screen.queryByTestId('buy-removeAds')).toBeNull();
    expect(screen.queryByTestId('restore-button')).toBeNull();
    expect(screen.queryByText(/Buy for/)).toBeNull();
    expect(screen.queryByText(/Try for 24 h/i)).toBeNull();
    expect(store.calls).toEqual([]);
    expect(ads.calls).toEqual([]);

    // Earned styles can still be used.
    await fireEvent.press(screen.getByTestId('cosmetic-dice-amber'));
    expect(screen.getByLabelText('Amber, In use')).toBeTruthy();
  });

  it('Help leaves out the questions about ads and purchases', async () => {
    await renderRouter(routes, { initialUrl: '/help' });
    expect(screen.getByText('Are the dice fair?')).toBeTruthy();
    expect(screen.queryByText('When do ads show?')).toBeNull();
    expect(screen.queryByText(/get my purchases back/)).toBeNull();
  });
});
