import '../i18n/i18n';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import DailyScreen from '../../app/daily';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import NewGameScreen from '../../app/new-game';
import OnboardingScreen from '../../app/onboarding';
import SettingsScreen from '../../app/settings';
import ShopScreen from '../../app/shop';
import StatsScreen from '../../app/stats';
import { useGameStore } from '../state/gameStore';
import { setUpAppData } from '../testing/appData';
import { resolveScheme } from '../ui/theme';

beforeEach(() => {
  setUpAppData();
  useGameStore.setState({ game: null, rollSeq: 0 });
});

const routes = {
  index: HomeScreen,
  game: GameScreen,
  final: FinalScreen,
  'new-game': NewGameScreen,
  daily: DailyScreen,
  stats: StatsScreen,
  shop: ShopScreen,
  settings: SettingsScreen,
  onboarding: OnboardingScreen,
};

describe('Home', () => {
  it('shows the app name and the main entries', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByRole('header', { name: 'Dice Den' })).toBeTruthy();
    for (const label of ['Play', 'Stats', 'Shop', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: "Today's dice, Same roll for everyone" })).toBeTruthy();
  });

  it.each([
    ['Play', '/new-game'],
    ['Pass and play, 2–6 at one table', '/new-game'],
    ["Today's dice, Same roll for everyone", '/daily'],
    ['Stats', '/stats'],
    ['Shop', '/shop'],
    ['Settings', '/settings'],
  ])('%s opens %s', async (label, path) => {
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(router.getPathname()).toBe(path);
  });
});

describe.each([
  ['/daily', "Today's dice"],
  ['/stats', 'Stats'],
  ['/shop', 'Shop'],
  ['/settings', 'Settings'],
  ['/onboarding', 'Welcome'],
])('placeholder %s', (path, title) => {
  it('renders its title and goes back home', async () => {
    const router = await renderRouter(routes, { initialUrl: path });
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/');
  });
});

describe('resolveScheme', () => {
  it.each([
    ['system', 'dark', 'dark'],
    ['system', null, 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)('%s with system %s → %s', (mode, system, expected) => {
    expect(resolveScheme(mode, system)).toBe(expected);
  });
});
