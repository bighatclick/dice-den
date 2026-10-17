import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import type { PlayerConfig } from '../engine/game';
import { CLASSIC } from '../engine/rules/presets';
import { getAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { setGameRng } from '../state/rng';
import { setUpAppData, scriptDice } from '../testing/appData';

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen };
const you = { id: 'p1', name: 'You', kind: 'human' as const, color: '#C77D4E' };
const cpu = { id: 'p2', name: 'Computer (Normal)', kind: 'ai' as const, aiLevel: 'normal' as const, color: '#3D525E' };

beforeEach(() => {
  setUpAppData();
  setGameRng(null);
  useGameStore.setState({ game: null, rollSeq: 0 });
});

const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('Game table (S3)', () => {
  it('starts a solo game with blank dice and no score options before the first roll', async () => {
    await renderRouter(routes, { initialUrl: '/game' });
    expect(useGameStore.getState().game?.players.map((p) => p.name)).toEqual(['You']);
    expect(screen.getByText('Roll to start your turn')).toBeTruthy();
    expect(screen.getByLabelText('Die 1, not rolled yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /score .* here/ })).toBeNull();
  });

  it('rolls, holds, shows hints, scores and undoes', async () => {
    scriptDice([5, 5, 2, 5, 6]);
    await renderRouter(routes, { initialUrl: '/game' });

    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(screen.getByLabelText('Die 1, showing 5')).toBeTruthy();
    expect(screen.getByText('Turn 1 · Roll 1 of 3')).toBeTruthy();
    expect(button('Fives, score 15 here')).toBeTruthy();
    expect(button('Chance, score 23 here')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Die 1, showing 5'));
    expect(screen.getByLabelText('Die 1, showing 5, held')).toBeTruthy();
    expect(useGameStore.getState().game?.held[0]).toBe(true);

    await fireEvent.press(button('Fives, score 15 here'));
    expect(screen.getByLabelText('Fives, scored 15')).toBeTruthy();
    expect(screen.getByText('Turn 2 · Ready to roll')).toBeTruthy();

    await fireEvent.press(button('Undo last score'));
    expect(button('Fives, score 15 here')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo last score' })).toBeNull();
  });

  it('turns the Roll button into "Pick a box" after three rolls', async () => {
    scriptDice([1, 2, 3, 4, 6]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Roll, 2 rolls left'));
    await fireEvent.press(button('Roll, 1 rolls left'));
    expect(screen.getByText('No rolls left · tap a box to score')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick a box' })).toBeDisabled();
    expect(screen.getByLabelText('Die 1, showing 1')).toBeDisabled();
  });

  it('hides point hints when hints are off but still lets you score', async () => {
    useSettingsStore.getState().update({ hints: false });
    scriptDice([3, 3, 3, 3, 3]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(screen.queryByText('15')).toBeNull();
    await fireEvent.press(button('Threes, score here'));
    expect(screen.getByLabelText('Threes, scored 15')).toBeTruthy();
  });

  it("shows other players' cards read-only and snaps back on their turn", async () => {
    scriptDice([4, 4, 4, 1, 2]);
    useGameStore.getState().start({ players: [you, cpu] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(screen.getByRole('tab', { name: "Show Computer (Normal)'s card" }));
    expect(screen.getByLabelText('Fours, empty')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Show your card' }));
    await fireEvent.press(button('Fours, score 12 here'));
    // Computer's turn now: its card is shown, nothing is tappable until it rolls.
    expect(screen.getByLabelText('Computer (Normal), 0 points, playing now')).toBeTruthy();
    // Regression: the hint used to say "Roll to start your turn" while the computer played.
    expect(screen.queryByText('Roll to start your turn')).toBeNull();
    expect(screen.getByText("Computer (Normal)'s turn")).toBeTruthy();
  });

  it('asks before leaving and says the game is saved', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const router = await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Leave game'));
    expect(alert).toHaveBeenCalledWith('Leave game?', expect.stringContaining("It's saved"), expect.any(Array));
    const leave = alert.mock.calls[0][2]!.find((b) => b.text === 'Leave')!;
    await act(async () => leave.onPress!());
    expect(router.getPathname()).toBe('/');
    expect(getAppData().inProgress).not.toBeNull();
    alert.mockRestore();
  });

  it('opens the final scorecard when the last box is scored', async () => {
    scriptDice([6, 6, 6, 6, 6]);
    const router = await renderRouter(routes, { initialUrl: '/game' });
    const { roll, score } = useGameStore.getState();
    await act(async () => {
      for (const box of CLASSIC.boxes.slice(0, -1)) {
        roll();
        score(box);
      }
      roll();
    });
    await fireEvent.press(button('Chance, score 30 here'));
    expect(router.getPathname()).toBe('/final');
  });
});

describe('Final scorecard (S5)', () => {
  function finishGame(faces: Parameters<typeof scriptDice>[0], players: PlayerConfig[] = [you]) {
    scriptDice(faces);
    const { start, roll, score } = useGameStore.getState();
    start({ players });
    for (let turn = 0; turn < CLASSIC.boxes.length * players.length; turn++) {
      roll();
      const game = useGameStore.getState().game!;
      const open = CLASSIC.boxes.find((b) => game.players[game.current].card[b] === undefined)!;
      score(open);
    }
  }

  it('shows the total, breakdown and a personal best, then goes home', async () => {
    finishGame([1, 1, 1, 1, 1]);
    useGameStore.getState().dismissFinished();
    finishGame([6, 6, 6, 6, 6]);
    const router = await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByRole('header', { name: 'FINAL SCORE' })).toBeTruthy();
    expect(screen.getByText('New personal best')).toBeTruthy();
    // Sixes every turn: 30 up top, no bonus; Yatzy box 50, then Chance takes a joker Yatzy.
    expect(screen.getByLabelText('Upper 30')).toBeTruthy();
    expect(screen.getByLabelText('Bonus 0')).toBeTruthy();
    expect(screen.getByLabelText('Yatzys 2')).toBeTruthy();
    await fireEvent.press(button('Home'));
    expect(router.getPathname()).toBe('/');
    expect(getAppData().inProgress).toBeNull();
  });

  it('names the winner against the computer and plays again with the same table', async () => {
    finishGame([2, 2, 2, 2, 2], [you, cpu]);
    const router = await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByRole('header', { name: "IT'S A TIE" })).toBeTruthy();
    expect(screen.queryByText('New personal best')).toBeNull();
    // The big number is the player's own score, so it says so when others played.
    expect(screen.getByText('Your score')).toBeTruthy();
    await fireEvent.press(button('Play again'));
    expect(router.getPathname()).toBe('/game');
    const game = useGameStore.getState().game!;
    expect(game.status).toBe('playing');
    expect(game.players.map((p) => p.name)).toEqual(['You', 'Computer (Normal)']);
  });

  it('sends you home if there is no finished game', async () => {
    const router = await renderRouter(routes, { initialUrl: '/final' });
    expect(router.getPathname()).toBe('/');
  });
});

describe('Home resume', () => {
  it('offers to resume a game in progress', async () => {
    useGameStore.getState().start({ players: [you] });
    await renderRouter(routes, { initialUrl: '/' });
    expect(button('Resume game, Turn 1 of 13')).toBeTruthy();
  });
});
