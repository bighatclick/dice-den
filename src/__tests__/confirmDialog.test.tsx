import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert, Platform } from 'react-native';
import GameScreen from '../../app/game';
import NewGameScreen from '../../app/new-game';
import { useGameStore } from '../state/gameStore';
import { setUpAppData } from '../testing/appData';
import { ConfirmHost } from '../ui/ConfirmDialog';

const routes = {
  index: () => null,
  'new-game': () => (
    <>
      <NewGameScreen />
      <ConfirmHost />
    </>
  ),
  game: GameScreen,
};

function startSoloGame() {
  useGameStore.getState().start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
}

beforeEach(() => {
  setUpAppData();
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
});

afterEach(() => jest.restoreAllMocks());

describe('Replacing a game in progress in the browser build', () => {
  // Regression: the web Alert does nothing, so Start game looked dead while a game was saved.
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

  it('asks in the app and starts the new game on confirm', async () => {
    startSoloGame();
    const before = useGameStore.getState().game;
    const alert = jest.spyOn(Alert, 'alert');
    const router = await renderRouter(routes, { initialUrl: '/new-game' });

    await fireEvent.press(screen.getByRole('button', { name: 'Start game' }));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByText('Start a new game?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Start new game' }));
    await act(async () => {});
    expect(useGameStore.getState().game).not.toBe(before);
    expect(router.getPathname()).toBe('/game');
  });

  it('keeps the saved game on cancel', async () => {
    startSoloGame();
    const before = useGameStore.getState().game;
    await renderRouter(routes, { initialUrl: '/new-game' });

    await fireEvent.press(screen.getByRole('button', { name: 'Start game' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Start a new game?')).toBeNull();
    expect(useGameStore.getState().game).toBe(before);
  });
});
