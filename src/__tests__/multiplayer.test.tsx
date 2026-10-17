import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import NewGameScreen from '../../app/new-game';
import type { PlayerConfig } from '../engine/game';
import { getAppData, updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { setGameRng } from '../state/rng';
import { scriptDice, setUpAppData } from '../testing/appData';

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen, 'new-game': NewGameScreen };
const human = (id: string, name: string): PlayerConfig => ({ id, name, kind: 'human', color: '#C77D4E' });
const computer: PlayerConfig = { id: 'c', name: 'Computer (Normal)', kind: 'ai', aiLevel: 'normal', color: '#55707E' };
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const game = () => useGameStore.getState().game!;

beforeEach(() => {
  jest.useRealTimers();
  setUpAppData();
  setGameRng(null);
  useGameStore.setState({ game: null, rollSeq: 0 });
});

describe('New game sheet (S2)', () => {
  it('starts a solo game with the chosen rules and remembers them', async () => {
    const router = await renderRouter(routes, { initialUrl: '/new-game' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Scandinavian, 15 boxes · bonus +50' }));
    await fireEvent(screen.getByLabelText('Forced order'), 'valueChange', true);
    await fireEvent.press(button('Start game'));
    expect(router.getPathname()).toBe('/game');
    expect(game()).toMatchObject({ preset: 'scandinavian', forcedOrder: true });
    expect(game().players.map((p) => p.name)).toEqual(['You']);
    expect(getAppData().settings).toMatchObject({ preset: 'scandinavian', forcedOrder: true });
  });

  it('starts a game against the chosen computer level', async () => {
    await renderRouter(routes, { initialUrl: '/new-game' });
    await fireEvent.press(screen.getByRole('radio', { name: 'vs Computer' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Expert' }));
    await fireEvent.press(button('Start game'));
    expect(game().players.map((p) => [p.name, p.kind, p.aiLevel])).toEqual([
      ['You', 'human', undefined],
      ['Computer (Expert)', 'ai', 'expert'],
    ]);
  });

  it('sets up pass and play with names, a computer seat, and add/remove', async () => {
    await renderRouter(routes, { initialUrl: '/new-game?opponents=pass' });
    await fireEvent.changeText(screen.getByLabelText('Player 1 name'), 'Mom');
    await fireEvent.press(button('Add player'));
    await fireEvent.press(button('Add player'));
    await fireEvent.press(button('Remove Player 4'));
    // Seat 3 becomes a computer.
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Computer' })[2]);
    await fireEvent.press(button('Start game'));
    expect(game().players.map((p) => p.name)).toEqual(['Mom', 'Player 2', 'Computer (Normal)']);
  });

  it('remembers the last pass-and-play table from the game log', async () => {
    updateAppData((d) => ({
        ...d,
        gameLog: [
          {
            id: 'old',
            finishedAt: 'x',
            mode: 'normal',
            preset: 'classic',
            players: [
              { name: 'Mom', kind: 'human', total: 200 },
              { name: 'Dad', kind: 'human', total: 180 },
            ],
            winnerIndexes: [0],
            humanFaceCounts: [0, 0, 0, 0, 0, 0],
            aiFaceCounts: [0, 0, 0, 0, 0, 0],
            extraYatzys: 0,
            upperBonusMade: false,
          },
        ],
      }));
    await renderRouter(routes, { initialUrl: '/new-game' });
    expect(screen.getByLabelText('Player 1 name').props.value).toBe('Mom');
    expect(screen.getByLabelText('Player 2 name').props.value).toBe('Dad');
  });

  it('asks before replacing a game in progress', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useGameStore.getState().start({ players: [human('a', 'You')] });
    const first = game().id;
    await renderRouter(routes, { initialUrl: '/new-game' });
    await fireEvent.press(button('Start game'));
    expect(alert).toHaveBeenCalledWith('Start a new game?', expect.any(String), expect.any(Array));
    expect(game().id).toBe(first);
    await act(async () => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
    expect(game().id).not.toBe(first);
    alert.mockRestore();
  });
});

describe('Computer turns', () => {
  it('plays itself step by step, and its card is read-only', async () => {
    jest.useFakeTimers();
    scriptDice([1, 2, 3, 4, 5]);
    useGameStore.getState().start({ players: [human('a', 'You'), computer] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Large straight, score 40 here'));
    expect(game().current).toBe(1);
    expect(button('Skip Computer (Normal)\'s turn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /score .* here/ })).toBeNull();

    // The person who just scored can still undo before the computer's first roll.
    expect(button('Undo last score')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1600));
    expect(game().rollsUsed).toBe(1);
    expect(screen.queryByRole('button', { name: 'Undo last score' })).toBeNull();

    await act(async () => jest.advanceTimersByTime(10_000));
    expect(game().current).toBe(0);
    expect(game().round).toBe(2);
  });

  it('skips the rest of the computer turn on tap', async () => {
    jest.useFakeTimers();
    scriptDice([6, 6, 6, 6, 6]);
    useGameStore.getState().start({ players: [human('a', 'You'), computer] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Sixes, score 30 here'));
    await fireEvent.press(button("Skip Computer (Normal)'s turn"));
    expect(game().current).toBe(0);
    expect(game().players[1].card).toEqual({ yatzy: 50 });
  });

  it("does not let a person undo the computer's score", () => {
    scriptDice([6, 6, 6, 6, 6]);
    const { start, roll, score, skipAiTurn, undo } = useGameStore.getState();
    start({ players: [human('a', 'You'), computer] });
    roll();
    score('chance');
    skipAiTurn();
    const after = game();
    undo();
    expect(game()).toBe(after);
    expect(useGameStore.getState().aiStep()).toBe(false);
  });
});

describe('Pass handoff (S4)', () => {
  it("covers the table between people and offers the last player's undo", async () => {
    scriptDice([3, 3, 3, 1, 2]);
    useGameStore.getState().start({ players: [human('a', 'Mom'), human('b', 'Dad')] });
    await renderRouter(routes, { initialUrl: '/game' });
    // Mom goes first with the phone already in hand: no handoff.
    expect(screen.queryByRole('header', { name: 'Dad' })).toBeNull();
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Threes, score 9 here'));

    expect(screen.getByRole('header', { name: 'Dad' })).toBeTruthy();
    expect(screen.getByText("Mom's dice hidden · Turn 1 of 13")).toBeTruthy();
    // Regression: screen readers could reach the table, and roll for Dad, behind the handoff.
    expect(screen.queryByRole('button', { name: 'Roll, 3 rolls left' })).toBeNull();
    await fireEvent.press(button("Undo Mom's last score"));
    expect(game().current).toBe(0);
    expect(screen.queryByRole('header', { name: 'Dad' })).toBeNull();

    await fireEvent.press(button('Threes, score 9 here'));
    await fireEvent.press(button("Start Dad's turn"));
    expect(screen.queryByRole('header', { name: 'Dad' })).toBeNull();
    expect(button('Roll, 3 rolls left')).toBeTruthy();
  });

  it('is not shown in a game with one person', async () => {
    scriptDice([3, 3, 3, 1, 2]);
    useGameStore.getState().start({ players: [human('a', 'You')] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Threes, score 9 here'));
    expect(screen.queryByText(/Pass the phone/)).toBeNull();
  });
});
