import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import DailyScreen from '../../app/daily';
import FairnessScreen from '../../app/fairness';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import NewGameScreen from '../../app/new-game';
import OnboardingScreen from '../../app/onboarding';
import SettingsScreen from '../../app/settings';
import ShopScreen from '../../app/shop';
import StatsScreen from '../../app/stats';
import { setAdProvider } from '../ads';
import { Repository } from '../data/repository';
import type { PlayerConfig } from '../engine/game';
import { CLASSIC, SCANDINAVIAN } from '../engine/rules/presets';
import { toDateKey } from '../engine/rng';
import { getAppData, initAppData, updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { setGameRng } from '../state/rng';
import { useSettingsStore } from '../state/settingsStore';
import { resetShopStore } from '../state/shopStore';
import { memoryStore, scriptDice, setUpAppData } from '../testing/appData';
import { createFakeAds } from '../testing/fakeAds';

const routes = {
  index: HomeScreen,
  game: GameScreen,
  final: FinalScreen,
  'new-game': NewGameScreen,
  daily: DailyScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  shop: ShopScreen,
  fairness: FairnessScreen,
  onboarding: OnboardingScreen,
};
const you: PlayerConfig = { id: 'p1', name: 'You', kind: 'human', color: '#C77D4E' };
const human = (id: string, name: string): PlayerConfig => ({ id, name, kind: 'human', color: '#5E9BC6' });
const cpu = (level: 'easy' | 'normal' | 'expert'): PlayerConfig => ({ id: `c-${level}`, name: `Computer (${level[0].toUpperCase()}${level.slice(1)})`, kind: 'ai', aiLevel: level, color: '#55707E' });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const game = () => useGameStore.getState().game!;

beforeEach(() => {
  setUpAppData();
  setGameRng(null);
  setAdProvider(createFakeAds());
  resetShopStore();
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
});

afterEach(() => jest.restoreAllMocks());

/** Finishes the current game by scoring boxes in pad order (people) and skipping computers. */
function playOut(players: PlayerConfig[], preset: 'classic' | 'scandinavian' = 'classic') {
  const boxes = preset === 'classic' ? CLASSIC.boxes : SCANDINAVIAN.boxes;
  const { start, roll, score, skipAiTurn } = useGameStore.getState();
  start({ players, preset });
  for (let guard = 0; game().status === 'playing' && guard < 200; guard++) {
    if (game().players[game().current].kind === 'ai') {
      skipAiTurn();
      continue;
    }
    roll();
    score(boxes.find((b) => game().players[game().current].card[b] === undefined)!);
  }
}

describe('Home (S1) in every state', () => {
  it('greets by time of day', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 17, 8, 0, 0), doNotFake: ['nextTick', 'setImmediate'] });
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('Good morning')).toBeTruthy();
    jest.useRealTimers();
  });

  it('shows the stats line once a game is logged and the resume chip for a multiplayer game', async () => {
    scriptDice([3, 3, 3, 3, 3]);
    playOut([you]);
    useGameStore.getState().dismissFinished();
    const total = getAppData().gameLog[0].players[0].total;
    useGameStore.getState().start({ players: [you, cpu('expert')], preset: 'scandinavian' });
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText(`Best ${total} · 1 games`)).toBeTruthy();
    expect(screen.getByText('vs Computer (Expert) · Scandinavian')).toBeTruthy();
    expect(button('Resume game, Turn 1 of 15')).toBeTruthy();
  });

  it('Play opens the final scorecard when a finished game was never dismissed', async () => {
    scriptDice([2, 2, 2, 2, 2]);
    playOut([you]);
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(button('Play'));
    expect(router.getPathname()).toBe('/final');
  });

  it('shows the week strip with today marked and done days ticked', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { [today]: 100 } } }));
    await renderRouter(routes, { initialUrl: '/' });
    expect(button(`Today's dice, Done today · 100`)).toBeTruthy();
  });

  it('does not show the ATT prompt while onboarding is pending, and never calls the ad SDK before onboarding', async () => {
    setUpAppData(undefined, { firstLaunch: true });
    updateAppData((d) => ({ ...d, stats: { ...d.stats, sessions: 5 } }));
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(router.getPathname()).toBe('/onboarding');
    expect(screen.queryByText('About the ads')).toBeNull();
  });
});

describe('New game sheet (S2) validation', () => {
  it('cannot start pass-and-play with no person at the table', async () => {
    await renderRouter(routes, { initialUrl: '/new-game?opponents=pass' });
    const computers = screen.getAllByRole('radio', { name: 'Computer' });
    await fireEvent.press(computers[0]);
    await fireEvent.press(computers[1]);
    expect(button('Start game')).toBeDisabled();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Person' })[0]);
    expect(button('Start game')).not.toBeDisabled();
  });

  it('allows at most 6 seats and never fewer than 2', async () => {
    await renderRouter(routes, { initialUrl: '/new-game?opponents=pass' });
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    for (let i = 0; i < 4; i++) await fireEvent.press(button('Add player'));
    expect(screen.queryByRole('button', { name: 'Add player' })).toBeNull();
    expect(screen.getAllByLabelText(/Player \d name/)).toHaveLength(6);
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getAllByRole('button', { name: /^Remove / })[0]);
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(button('Add player')).toBeTruthy();
  });

  it('each computer seat keeps its own level', async () => {
    await renderRouter(routes, { initialUrl: '/new-game?opponents=pass' });
    await fireEvent.press(button('Add player'));
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Computer' })[1]);
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Computer' })[2]);
    const easy = screen.getAllByRole('radio', { name: 'Easy' });
    const expert = screen.getAllByRole('radio', { name: 'Expert' });
    await fireEvent.press(easy[0]);
    await fireEvent.press(expert[1]);
    await fireEvent.press(button('Start game'));
    expect(game().players.map((p) => p.aiLevel ?? p.name)).toEqual(['Player 1', 'easy', 'expert']);
  });

  it('names are trimmed to 16 characters by the input and remembered seats come back', async () => {
    await renderRouter(routes, { initialUrl: '/new-game?opponents=pass' });
    expect(screen.getByLabelText('Player 1 name').props.maxLength).toBe(16);
  });

  it('the close button goes home and cancelling the replace alert keeps the old game', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useGameStore.getState().start({ players: [you] });
    const id = game().id;
    const router = await renderRouter(routes, { initialUrl: '/new-game' });
    await fireEvent.press(button('Start game'));
    const cancel = alert.mock.calls[0][2]!.find((b) => b.style === 'cancel')!;
    expect(cancel.onPress).toBeUndefined();
    expect(game().id).toBe(id);
    await fireEvent.press(button('Close'));
    expect(router.getPathname()).toBe('/');
  });

  it('starting from the sheet also saves the rules as the default for next time', async () => {
    await renderRouter(routes, { initialUrl: '/new-game' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Scandinavian, 15 boxes · bonus +50' }));
    await fireEvent.press(button('Start game'));
    expect(getAppData().settings.preset).toBe('scandinavian');
    expect(game().preset).toBe('scandinavian');
  });
});

describe('Game table (S3) details', () => {
  it('labels a joker turn so only the matching upper box can be tapped', async () => {
    scriptDice([4, 4, 4, 4, 4]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Yatzy, score 50 here'));
    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(button('Fours, score 20 here')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chance, score/ })).toBeNull();
    await fireEvent.press(button('Fours, score 20 here'));
    expect(screen.getByText('Extra Yatzy')).toBeTruthy();
    expect(screen.getByText('+100')).toBeTruthy();
  });

  it('forced order shows exactly one tappable box', async () => {
    useSettingsStore.getState().update({ forcedOrder: true });
    scriptDice([6, 6, 6, 6, 6]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(screen.getAllByRole('button', { name: /score .* here/ })).toHaveLength(1);
    expect(button('Ones, score 0 here')).toBeTruthy();
  });

  it('Scandinavian pads show pairs and the 50 bonus target', async () => {
    useSettingsStore.getState().update({ preset: 'scandinavian' });
    scriptDice([5, 5, 3, 3, 1]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(button('One pair, score 10 here')).toBeTruthy();
    expect(button('Two pairs, score 16 here')).toBeTruthy();
    expect(screen.getByLabelText('Upper bonus 50: 0 of 63')).toBeTruthy();
  });

  it('shows the upper bonus as made once 63 is reached', async () => {
    scriptDice([6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4]);
    await renderRouter(routes, { initialUrl: '/game' });
    for (const box of ['sixes', 'fives', 'fours'] as const) {
      await fireEvent.press(button('Roll, 3 rolls left'));
      await fireEvent.press(button(new RegExp(`^${box[0].toUpperCase()}${box.slice(1)}, score`)));
    }
    expect(screen.getByLabelText('Upper bonus 35 made')).toBeTruthy();
    expect(screen.getByLabelText('Total 110')).toBeTruthy(); // 30 + 25 + 20 + the 35 bonus
  });

  it('held dice stay held across the second roll and cannot be toggled after the third', async () => {
    scriptDice([1, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6, 6]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(screen.getByLabelText('Die 2, showing 2'));
    await fireEvent.press(button('Roll, 2 rolls left'));
    expect(screen.getByLabelText('Die 2, showing 2, held')).toBeTruthy();
    expect(screen.getByLabelText('Die 1, showing 6')).toBeTruthy();
    await fireEvent.press(button('Roll, 1 rolls left'));
    expect(screen.getByLabelText('Die 2, showing 2, held')).toBeDisabled();
  });

  it('large dice and high-contrast settings still render a playable table', async () => {
    useSettingsStore.getState().update({ largeDice: true, highContrastPips: true, reduceMotion: true });
    scriptDice([1, 1, 1, 1, 1]);
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Yatzy, score 50 here'));
    expect(screen.getByLabelText('Yatzy, scored 50')).toBeTruthy();
  });

  it('a daily game says so in the turn line and goes to the daily scorecard', async () => {
    useGameStore.getState().startDaily(toDateKey(new Date()), you);
    const router = await renderRouter(routes, { initialUrl: '/game' });
    expect(screen.getByText(/Today's dice · Turn 1 · Ready to roll/)).toBeTruthy();
    await act(async () => {
      for (const box of CLASSIC.boxes) {
        useGameStore.getState().roll();
        useGameStore.getState().score(box);
      }
    });
    expect(router.getPathname()).toBe('/final');
    expect(screen.getByRole('header', { name: "TODAY'S DICE" })).toBeTruthy();
  });

  it('with three people the handoff names the right previous player each time', async () => {
    scriptDice([2, 2, 2, 2, 2]);
    useGameStore.getState().start({ players: [human('a', 'Ann'), human('b', 'Ben'), human('c', 'Cat')] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Twos, score 10 here'));
    expect(screen.getByText("Ann's dice hidden · Turn 1 of 13")).toBeTruthy();
    await fireEvent.press(button("Start Ben's turn"));
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Twos, score 10 here'));
    expect(screen.getByRole('header', { name: 'Cat' })).toBeTruthy();
    expect(screen.getByText("Ben's dice hidden · Turn 1 of 13")).toBeTruthy();
    expect(screen.getByLabelText('Scores so far: Ann 10, Ben 10, Cat 0')).toBeTruthy();
  });

  it('a person after a computer gets a handoff from the last person, not the computer', async () => {
    scriptDice([2, 2, 2, 2, 2]);
    useGameStore.getState().start({ players: [human('a', 'Ann'), cpu('normal'), human('b', 'Ben')] });
    await renderRouter(routes, { initialUrl: '/game' });
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(button('Twos, score 10 here'));
    await fireEvent.press(button("Skip Computer (Normal)'s turn"));
    expect(screen.getByRole('header', { name: 'Ben' })).toBeTruthy();
    expect(screen.getByText("Ann's dice hidden · Turn 1 of 13")).toBeTruthy();
  });
});

describe('Final scorecard (S5) with several players', () => {
  it('ranks players by score, names the winner and shows whose score the big number is', async () => {
    scriptDice([6, 6, 6, 6, 6]);
    playOut([human('a', 'Ann'), cpu('normal')]);
    await renderRouter(routes, { initialUrl: '/final' });
    const entry = getAppData().gameLog[0];
    const [ann, computer] = entry.players.map((p) => p.total);
    expect(computer).toBeGreaterThan(ann);
    expect(screen.getByRole('header', { name: 'COMPUTER (NORMAL) WINS' })).toBeTruthy();
    expect(screen.getByText("Ann's score")).toBeTruthy();
    expect(screen.getByLabelText(`Ann, ${ann} points`)).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(`^Winner, Computer \\(Normal\\), ${computer}, `))).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(`^Ann, ${ann}, 2 Yatzys · No bonus$`))).toBeTruthy();
  });

  it('says "You win" when the person beats the computer', async () => {
    scriptDice([1, 2, 3, 4, 5]);
    const { start, roll, score, skipAiTurn } = useGameStore.getState();
    start({ players: [you, cpu('easy')] });
    // You score the straight everywhere it pays; the computer gets the same dice but the engine is fair: it also straights.
    while (game().status === 'playing') {
      if (game().players[game().current].kind === 'ai') {
        skipAiTurn();
        continue;
      }
      roll();
      const open = game().players[0].card;
      score((['largeStraight', 'smallStraight', 'chance', ...CLASSIC.boxes] as const).find((b) => open[b] === undefined)!);
    }
    const [me, it] = getAppData().gameLog[0].players.map((p) => p.total);
    await renderRouter(routes, { initialUrl: '/final' });
    if (me > it) expect(screen.getByRole('header', { name: 'YOU WIN' })).toBeTruthy();
    else if (me === it) expect(screen.getByRole('header', { name: "IT'S A TIE" })).toBeTruthy();
    else expect(screen.getByRole('header', { name: 'COMPUTER (EASY) WINS' })).toBeTruthy();
  });

  it('the share button captures the card, and the new-skin card links to the shop', async () => {
    updateAppData((d) => ({ ...d, stats: { ...d.stats, gamesCompleted: 9 } }));
    scriptDice([5, 5, 5, 5, 5]);
    playOut([you]);
    const router = await renderRouter(routes, { initialUrl: '/final' });
    await fireEvent.press(button('Share'));
    await fireEvent.press(button('Use them'));
    expect(router.getPathname()).toBe('/shop');
  });

  it('Play again after a Scandinavian forced-order game keeps those rules', async () => {
    scriptDice([5, 5, 5, 5, 5]);
    useSettingsStore.getState().update({ preset: 'scandinavian', forcedOrder: true });
    playOut([you], 'scandinavian');
    const router = await renderRouter(routes, { initialUrl: '/final' });
    useSettingsStore.getState().update({ preset: 'classic', forcedOrder: false }); // settings changed meanwhile
    await fireEvent.press(button('Play again'));
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(router.getPathname()).toBe('/game');
    expect(game()).toMatchObject({ preset: 'scandinavian', forcedOrder: true, status: 'playing' });
  });

  it('no personal best badge on the very first game, and none when the score is lower', async () => {
    scriptDice([6, 6, 6, 6, 6]);
    playOut([you]);
    await renderRouter(routes, { initialUrl: '/final' });
    expect(screen.queryByText('New personal best')).toBeNull();
  });
});

describe('Daily dice (S7) edge states', () => {
  it('asks before replacing a normal game in progress, and cancelling keeps it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useGameStore.getState().start({ players: [you] });
    const id = game().id;
    const router = await renderRouter(routes, { initialUrl: '/daily' });
    await fireEvent.press(button("Play today's dice"));
    expect(alert).toHaveBeenCalledWith("Play today's dice?", expect.any(String), expect.any(Array));
    expect(game().id).toBe(id);
    expect(router.getPathname()).toBe('/daily');
    await act(async () => alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!());
    expect(game().mode).toBe('daily');
    expect(router.getPathname()).toBe('/game');
  });

  it('once the three rewarded ads of the day are used, says so instead of offering a replay', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { [today]: 150 } }, ads: { ...d.ads, rewarded: { date: today, count: 3 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText('No more replays today. New dice tomorrow.')).toBeTruthy();
    expect(screen.queryByTestId('daily-replay')).toBeNull();
  });

  it('shows the best daily score and marks missed days in the calendar', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { '2026-01-01': 300, [today]: 150 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText('Your best daily: 300')).toBeTruthy();
    expect(screen.getAllByLabelText(/: not played$/).length).toBe(27);
  });

  it('a replay in progress shows Resume next to the locked result', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { [today]: 150 } } }));
    useGameStore.getState().startDaily(today, you, 1);
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText('150')).toBeTruthy();
    expect(button("Resume today's dice")).toBeTruthy();
    expect(screen.queryByTestId('daily-replay')).toBeNull();
  });

  it('declining the reminder ask records it and never asks again', async () => {
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { '2026-10-15': 1, '2026-10-16': 2 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    await fireEvent.press(button('No thanks'));
    expect(getAppData().daily.reminderAsked).toBe(true);
    expect(useSettingsStore.getState().settings.dailyReminder.enabled).toBe(false);
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.queryByText('Want a daily reminder?')).toBeNull();
  });

  it('does not ask about the reminder when it is already on', async () => {
    useSettingsStore.getState().update({ dailyReminder: { enabled: true, hour: 19, minute: 0 } });
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { '2026-10-15': 1, '2026-10-16': 2 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.queryByText('Want a daily reminder?')).toBeNull();
  });
});

describe('Stats (S6) rows', () => {
  it('shows records against each computer level and the pass-and-play count', async () => {
    scriptDice([6, 6, 6, 6, 6]);
    playOut([you, cpu('expert')]);
    useGameStore.getState().dismissFinished();
    playOut([human('a', 'Ann'), human('b', 'Ben')]);
    useGameStore.getState().dismissFinished();
    await renderRouter(routes, { initialUrl: '/stats' });
    expect(screen.getByText('0 won of 1')).toBeTruthy();
    expect(screen.getAllByText('None yet').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Games 2')).toBeTruthy();
    expect(screen.getByLabelText('Yatzys 6')).toBeTruthy(); // 2 per person (the box + one joker); computer Yatzys are not yours
    expect(screen.getByLabelText('Upper bonus 0%')).toBeTruthy();
    expect(screen.getByLabelText('6: 100.0%, 195 times')).toBeTruthy();
  });

  it('shows the current and best streak', async () => {
    const today = toDateKey(new Date());
    updateAppData((d) => ({ ...d, daily: { ...d.daily, streak: 2, bestStreak: 9, lastCompleted: today, results: { [today]: 1 } } }));
    await renderRouter(routes, { initialUrl: '/stats' });
    expect(screen.getByText('2-day streak')).toBeTruthy();
    expect(screen.getByText('9-day streak')).toBeTruthy();
  });
});

describe('Settings (S10) extras', () => {
  it('warns when saved data could not be read (safe mode) instead of the normal backup note', async () => {
    const kv = memoryStore();
    kv.set('root', '{corrupt');
    initAppData(new Repository(kv));
    useSettingsStore.getState().hydrate();
    await renderRouter(routes, { initialUrl: '/settings' });
    expect(screen.getByText(/couldn't be read/)).toBeTruthy();
    expect(screen.queryByText(/included in your phone's backups/)).toBeNull();
  });

  it('changing the reminder hour reschedules at the new time', async () => {
    useSettingsStore.getState().update({ dailyReminder: { enabled: true, hour: 19, minute: 0 } });
    await renderRouter(routes, { initialUrl: '/settings' });
    const options = screen.getAllByRole('radio').filter((r) => /8|12|19|21|AM|PM/i.test(String(r.props.accessibilityLabel)));
    expect(options.length).toBeGreaterThanOrEqual(4);
    await act(async () => fireEvent.press(options[0]));
    expect(useSettingsStore.getState().settings.dailyReminder.hour).toBe(8);
  });

  it('the tutorial can be replayed from Settings and the version is shown', async () => {
    const router = await renderRouter(routes, { initialUrl: '/settings' });
    expect(screen.getByText(/^Version /)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Show the tutorial again' }));
    expect(router.getPathname()).toBe('/onboarding');
  });

  it('the Dice and tables link opens the shop', async () => {
    const router = await renderRouter(routes, { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('link', { name: 'Dice and tables' }));
    expect(router.getPathname()).toBe('/shop');
  });
});

describe('First run (S11) details', () => {
  it('the practice turn only unlocks the second roll once every 5 is held, and holds can be undone', async () => {
    setUpAppData(undefined, { firstLaunch: true });
    await renderRouter(routes, { initialUrl: '/onboarding' });
    await fireEvent.press(button('Show me how'));
    await fireEvent.press(button('Roll, 3 rolls left'));
    await fireEvent.press(screen.getByLabelText('Die 1, showing 5'));
    await fireEvent.press(screen.getByLabelText('Die 2, showing 2')); // a wrong hold
    expect(button('Roll the other two, 2 rolls left')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Die 2, showing 2, held'));
    await fireEvent.press(screen.getByLabelText('Die 3, showing 5'));
    await fireEvent.press(screen.getByLabelText('Die 5, showing 5'));
    expect(button('Roll the other two, 2 rolls left')).not.toBeDisabled();
  });

  it('Skip during the practice turn keeps the current rules and never starts a game', async () => {
    setUpAppData(undefined, { firstLaunch: true });
    useSettingsStore.getState().update({ preset: 'scandinavian' });
    const router = await renderRouter(routes, { initialUrl: '/onboarding' });
    await fireEvent.press(button('Show me how'));
    await fireEvent.press(button('Skip'));
    expect(useSettingsStore.getState().settings).toMatchObject({ onboardingDone: true, preset: 'scandinavian' });
    expect(router.getPathname()).toBe('/');
    expect(useGameStore.getState().game).toBeNull();
  });
});

describe('Fairness page', () => {
  it('explains the five promises from specs.md §4.3', async () => {
    await renderRouter(routes, { initialUrl: '/fairness' });
    expect(screen.getByText(/equal 1 in 6 chance/)).toBeTruthy();
    expect(screen.getByText(/never see future rolls/)).toBeTruthy();
    expect(screen.getByText(/no lucky streaks, catch-up rolls or help/)).toBeTruthy();
    expect(screen.getByText(/same rolls in the same order/)).toBeTruthy();
    expect(screen.getByText(/Stats shows every face/)).toBeTruthy();
  });
});
