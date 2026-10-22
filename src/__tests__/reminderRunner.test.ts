import '../i18n/i18n';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus } from 'react-native';
import { CLASSIC } from '../engine/rules/presets';
import { toDateKey } from '../engine/rng';
import { enableDailyReminder, refreshDailyReminder, reminderTimes } from '../notifications/reminder';
import { reminderText, startReminderRefresh } from '../notifications/reminderRunner';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { scriptDice, setUpAppData } from '../testing/appData';

const text = { title: 'T', body: 'B' };
const scheduled = () => (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([r]) => r as { identifier: string; trigger: { date: Date } });
/** Lets the chain of awaited notification calls (permissions, cancel, 7 schedules) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  setUpAppData();
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
});

describe('reminder scheduling details (F13)', () => {
  it('schedules exactly 7 one-off notifications with unique per-day identifiers and the chosen minute', async () => {
    await enableDailyReminder(21, 30, text, false, new Date(2026, 9, 17, 9));
    const all = scheduled();
    expect(all).toHaveLength(7);
    expect(new Set(all.map((n) => n.identifier)).size).toBe(7);
    expect(all[0].identifier).toBe('daily-dice-reminder-2026-10-17');
    expect(all[0].trigger.date.getMinutes()).toBe(30);
    expect(all[0].trigger.date.getHours()).toBe(21);
    expect(all[6].identifier).toBe('daily-dice-reminder-2026-10-23');
  });

  it('a reminder at midnight is tomorrow when enabled at 00:00 exactly', () => {
    const times = reminderTimes(new Date(2026, 9, 17, 0, 0), 0, 0, false);
    expect(times[0]).toEqual(new Date(2026, 9, 18, 0, 0));
  });

  it('a reminder set one minute ahead still fires today', () => {
    const times = reminderTimes(new Date(2026, 9, 17, 18, 59), 19, 0, false);
    expect(times[0]).toEqual(new Date(2026, 9, 17, 19, 0));
  });

  it('crosses the year end', () => {
    const times = reminderTimes(new Date(2026, 11, 30, 20), 8, 0, false, 3);
    expect(times.map((t) => `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`)).toEqual(['2026-12-31', '2027-1-1', '2027-1-2']);
  });

  it('enable asks for permission only when not already granted, and a throwing scheduler reports false', async () => {
    await enableDailyReminder(19, 0, text, false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await enableDailyReminder(19, 0, text, false);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(new Error('os'));
    await expect(enableDailyReminder(19, 0, text, false)).resolves.toBe(false);
  });

  it('refresh never asks for permission and is silent when denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await refreshDailyReminder(19, 0, text, false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(new Error('x'));
    await expect(refreshDailyReminder(19, 0, text, false)).resolves.toBeUndefined();
  });

  it('the notification text comes from en.json and is not marketing', () => {
    expect(reminderText()).toEqual({ title: "Today's dice are ready", body: 'Same roll for everyone. Keep your streak going.' });
    expect(JSON.stringify(reminderText())).not.toMatch(/sale|offer|discount|buy|%/i);
  });
});

describe('startReminderRefresh', () => {
  it('refreshes at start, when the app becomes active, and when a daily game finishes; stops cleanly', async () => {
    useSettingsStore.getState().update({ dailyReminder: { enabled: true, hour: 23, minute: 59 } });
    const handlers: ((s: AppStateStatus) => void)[] = [];
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as (s: AppStateStatus) => void);
      return { remove };
    });
    const stop = startReminderRefresh();
    await flush();
    const afterStart = scheduled().length;
    expect(afterStart).toBe(7);

    handlers[0]('background');
    await flush();
    expect(scheduled().length).toBe(afterStart);
    handlers[0]('active');
    await flush();
    expect(scheduled().length).toBe(afterStart + 7);

    // Finishing today's dice moves the next reminder to tomorrow.
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    scriptDice([1, 1, 1, 1, 1]);
    useGameStore.getState().startDaily(toDateKey(new Date()), { id: 'p1', name: 'You', kind: 'human', color: '#000' });
    for (const box of CLASSIC.boxes) {
      useGameStore.getState().roll();
      useGameStore.getState().score(box);
    }
    await flush();
    expect(scheduled().length).toBe(7);
    expect(scheduled()[0].trigger.date.getDate()).not.toBe(new Date().getDate());

    // A normal game finishing does not reschedule.
    jest.clearAllMocks();
    useGameStore.getState().dismissFinished();
    useGameStore.getState().start({ players: [{ id: 'p1', name: 'You', kind: 'human', color: '#000' }] });
    for (const box of CLASSIC.boxes) {
      useGameStore.getState().roll();
      useGameStore.getState().score(box);
    }
    await flush();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    stop();
    expect(remove).toHaveBeenCalled();
  });

  it('does nothing when the reminder is off', async () => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
    const stop = startReminderRefresh();
    await flush();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    stop();
  });
});
