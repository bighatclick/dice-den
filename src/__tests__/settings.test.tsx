import '../i18n/i18n';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { renderRouter } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import DailyScreen from '../../app/daily';
import FairnessScreen from '../../app/fairness';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import OnboardingScreen from '../../app/onboarding';
import SettingsScreen from '../../app/settings';
import StatsScreen from '../../app/stats';
import { getAppData, updateAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { setGameRng } from '../state/rng';
import { useSettingsStore } from '../state/settingsStore';
import { scriptDice, setUpAppData } from '../testing/appData';
import { playSound } from '../ui/sound';

const routes = {
  index: HomeScreen,
  game: GameScreen,
  daily: DailyScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  fairness: FairnessScreen,
  onboarding: OnboardingScreen,
};
const settings = () => useSettingsStore.getState().settings;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  setUpAppData();
  setGameRng(null);
  useGameStore.setState({ game: null, rollSeq: 0 });
  jest.clearAllMocks();
});

describe('Settings (S10)', () => {
  it('saves every toggle at once and stamps it for sync', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    const toggles = [
      ['Forced order', 'forcedOrder'],
      ['Score hints', 'hints'],
      ['Sound effects', 'sound'],
      ['Haptics', 'haptics'],
      ['Large dice', 'largeDice'],
      ['High-contrast pips', 'highContrastPips'],
      ['Left-hand layout', 'leftHanded'],
      ['Reduce motion', 'reduceMotion'],
    ] as const;
    for (const [label, key] of toggles) {
      const before = settings()[key];
      await fireEvent(screen.getByLabelText(label), 'valueChange', !before);
      expect(settings()[key]).toBe(!before);
      expect(getAppData().settings[key]).toBe(!before);
    }
    expect(getAppData().syncMeta.settingsUpdatedAt).not.toBeNull();
  });

  it('changes rules, theme and computer speed', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Scandinavian, 15 boxes · bonus +50' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Fast' }));
    expect(settings()).toMatchObject({ preset: 'scandinavian', themeMode: 'dark', aiSpeed: 'fast' });
  });

  it('turns the daily reminder on and off, and says when notifications are denied', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    await act(async () => fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { type: 'daily', hour: 19, minute: 0 },
        content: expect.objectContaining({ title: "Today's dice are ready" }),
      }),
    );
    expect(settings().dailyReminder.enabled).toBe(true);

    await act(async () => fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', false));
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(settings().dailyReminder.enabled).toBe(false);

    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await act(async () => fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true));
    expect(settings().dailyReminder.enabled).toBe(false);
    expect(screen.getByText(/Notifications are off/)).toBeTruthy();
  });

  it('opens the fairness page and the legal links', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const router = await renderRouter(routes, { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
    expect(open).toHaveBeenCalledWith('https://dicedengame.com/privacy');
    await fireEvent.press(screen.getByRole('link', { name: 'How the dice work' }));
    expect(router.getPathname()).toBe('/fairness');
    expect(screen.getByText(/same dice, from the same generator/)).toBeTruthy();
    await fireEvent.press(button('See your dice in Stats'));
    expect(router.getPathname()).toBe('/stats');
  });

  it('keeps the table playable in the left-hand layout', async () => {
    useSettingsStore.getState().update({ leftHanded: true });
    await renderRouter(routes, { initialUrl: '/game' });
    expect(button('Roll, 3 rolls left')).toBeTruthy();
  });
});

describe('Sound', () => {
  it('plays only when Sound is on', () => {
    playSound('hold');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    useSettingsStore.getState().update({ sound: false });
    playSound('roll');
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
  });
});

describe('Daily reminder ask (F13)', () => {
  it('asks once, after the second daily completion', async () => {
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { '2026-10-15': 200, '2026-10-16': 210 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.getByText('Want a daily reminder?')).toBeTruthy();
    await act(async () => fireEvent.press(button('Remind me')));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(getAppData().daily.reminderAsked).toBe(true);
    expect(screen.queryByText('Want a daily reminder?')).toBeNull();
  });

  it('is not shown after one completion', async () => {
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { '2026-10-16': 210 } } }));
    await renderRouter(routes, { initialUrl: '/daily' });
    expect(screen.queryByText('Want a daily reminder?')).toBeNull();
  });
});

describe('First run (S11)', () => {
  beforeEach(() => {
    setUpAppData(undefined, { firstLaunch: true });
  });

  it('opens on first launch and can be skipped', async () => {
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(router.getPathname()).toBe('/onboarding');
    await fireEvent.press(button('Skip'));
    expect(settings().onboardingDone).toBe(true);
    expect(router.getPathname()).toBe('/');
    expect(screen.getByRole('header', { name: 'Dice Den' })).toBeTruthy();
  });

  it('teaches roll, hold and score, then saves the chosen rules', async () => {
    scriptDice([1, 1, 1, 1, 1]); // the practice turn never uses the game dice
    const router = await renderRouter(routes, { initialUrl: '/onboarding' });
    await fireEvent.press(button('Show me how'));
    await fireEvent.press(button('Roll, 3 rolls left'));
    expect(button('Roll the other two, 2 rolls left')).toBeDisabled();
    for (const i of [1, 3, 5]) await fireEvent.press(screen.getByLabelText(`Die ${i}, showing 5`));
    await fireEvent.press(button('Roll the other two, 2 rolls left'));
    await fireEvent.press(button('Fives, score 20 here'));
    await fireEvent.press(button('Next'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Scandinavian, 15 boxes · bonus +50' }));
    await fireEvent.press(button('Start playing'));
    expect(settings()).toMatchObject({ onboardingDone: true, preset: 'scandinavian' });
    expect(router.getPathname()).toBe('/');
    expect(useGameStore.getState().game).toBeNull();
  });
});
