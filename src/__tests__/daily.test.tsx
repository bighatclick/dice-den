import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router as appRouter } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import * as Sharing from 'expo-sharing';
import DailyScreen from '../../app/daily';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import StatsScreen from '../../app/stats';
import { CLASSIC } from '../engine/rules/presets';
import { getAppData, updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { setGameRng } from '../state/rng';
import { scriptDice, setUpAppData } from '../testing/appData';

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen, daily: DailyScreen, stats: StatsScreen };
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const TODAY = '2026-10-17';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 17, 12, 0, 0), doNotFake: ['nextTick', 'setImmediate'] });
  setUpAppData();
  setGameRng(null);
  useGameStore.setState({ game: null, rollSeq: 0 });
  (Sharing.shareAsync as jest.Mock).mockClear();
});
afterEach(() => jest.useRealTimers());

function finishDaily() {
  const { roll, score } = useGameStore.getState();
  for (const box of CLASSIC.boxes) {
    roll();
    score(box);
  }
}

describe('Daily dice (S7)', () => {
  it("starts today's seeded game and resumes it", async () => {
    const router = await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText('0-day streak')).toBeTruthy();
    await fireEvent.press(button("Play today's dice"));
    expect(router.getPathname()).toBe('/game');
    expect(useGameStore.getState().game).toMatchObject({ id: `daily-${TODAY}`, mode: 'daily', preset: 'classic' });
    expect(screen.getByText(/Today's dice · Turn 1/)).toBeTruthy();

    await act(async () => appRouter.back());
    expect(button("Resume today's dice")).toBeTruthy();
  });

  it('shows the locked result, streak and calendar, and shares it', async () => {
    useGameStore.getState().startDaily(TODAY, { id: 'p1', name: 'You', kind: 'human', color: '#000' });
    finishDaily();
    const score = getAppData().daily.results[TODAY];
    useGameStore.getState().dismissFinished();
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText(String(score))).toBeTruthy();
    expect(screen.getByLabelText('1-day streak, Best 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Play today's dice" })).toBeNull();
    // The date part depends on the device language.
    expect(screen.getByLabelText(new RegExp(`17.*: ${score}$`))).toBeTruthy();
    await fireEvent.press(button('Share result'));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/share.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  it('shows the streak and today\'s result on Home', async () => {
    updateAppData((d) => ({ ...d, daily: { ...d.daily, streak: 3, bestStreak: 3, lastCompleted: TODAY, results: { [TODAY]: 244 } } }));
    await renderRouter(routes, { initialUrl: '/' });
    expect(button("Today's dice, Done today · 244 · 3-day streak")).toBeTruthy();
  });

  it('daily final scorecard has Share and Home but no Play again', async () => {
    scriptDice([6, 6, 6, 6, 6]);
    useGameStore.getState().startDaily(TODAY, { id: 'p1', name: 'You', kind: 'human', color: '#000' });
    finishDaily();
    await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.getByRole('header', { name: "TODAY'S DICE" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
    await fireEvent.press(button('Share'));
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });
});

describe('Stats (S6)', () => {
  it('shows an empty state with no games', async () => {
    await renderRouter(routes, { initialUrl: '/stats' });
    expect(screen.getByText('Finish a game to see your stats here.')).toBeTruthy();
    expect(screen.getByLabelText('Games 0')).toBeTruthy();
  });

  it('summarises finished games and the dice distribution, filtered by rules', async () => {
    scriptDice([1, 2, 3, 4, 5, 6]);
    const { start } = useGameStore.getState();
    start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
    finishDaily();
    const total = getAppData().gameLog[0].players[0].total;
    await renderRouter(routes, { initialUrl: '/stats' });
    expect(screen.getByLabelText('Games 1')).toBeTruthy();
    expect(screen.getByLabelText(`High score ${total}`)).toBeTruthy();
    // 13 rolls of 5 dice cycling 1..6: 65 faces, 11 ones.
    expect(screen.getByLabelText('1: 16.9%, 11 times')).toBeTruthy();
    expect(screen.getByText('65 rolls')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Scandinavian' }));
    expect(screen.getByLabelText('Games 0')).toBeTruthy();
  });
});
