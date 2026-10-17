import '../i18n/i18n';
import { act, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert, BackHandler } from 'react-native';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import { setAdProvider } from '../ads';
import { CLASSIC } from '../engine/rules/presets';
import { useGameStore } from '../state/gameStore';
import { createFakeAds } from '../testing/fakeAds';
import { scriptDice, setUpAppData } from '../testing/appData';

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen };

/** Records Back handlers; pressing Back calls the newest first until one handles it, as Android does. */
function captureBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: Handler[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return { remove: () => void handlers.splice(handlers.indexOf(handler), 1) };
  });
  return () => [...handlers].reverse().some((h) => (h as () => boolean | null | undefined)() === true);
}

beforeEach(() => {
  setUpAppData();
  setAdProvider(createFakeAds());
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
});

afterEach(() => jest.restoreAllMocks());

describe('Android Back', () => {
  // The scorecard case runs first: the open Leave alert of the table case keeps the router on /game.
  it('on the final scorecard goes Home', async () => {
    scriptDice([3, 3, 3, 3, 3]);
    const { start, roll, score } = useGameStore.getState();
    start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
    for (const box of CLASSIC.boxes) {
      roll();
      score(box);
    }
    const pressBack = captureBack();
    const router = await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByText('Play again')).toBeTruthy();
    await act(async () => {
      pressBack();
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(router.getPathname()).toBe('/');
    expect(useGameStore.getState().game).toBeNull();
  });

  it('on the game table asks "Leave game?" instead of leaving', async () => {
    const pressBack = captureBack();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useGameStore.getState().start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
    const router = await renderRouter(routes, { initialUrl: '/game' });
    let handled = false;
    act(() => {
      handled = pressBack();
    });
    expect(handled).toBe(true);
    expect(alert).toHaveBeenCalledWith('Leave game?', expect.any(String), expect.any(Array));
    expect(router.getPathname()).toBe('/game');
  });
});
