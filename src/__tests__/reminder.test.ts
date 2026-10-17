import '../i18n/i18n';
import * as Notifications from 'expo-notifications';
import { disableDailyReminder, enableDailyReminder, reminderTimes, REMINDER_DAYS } from '../notifications/reminder';
import { playedToday, refreshReminderFromSettings } from '../notifications/reminderRunner';
import { updateAppData } from '../state/appData';
import { useSettingsStore } from '../state/settingsStore';
import { setUpAppData } from '../testing/appData';

const text = { title: "Today's dice are ready", body: 'Same roll for everyone.' };
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const scheduledDates = () =>
  (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([req]) => (req.trigger as { date: Date }).date);

beforeEach(() => {
  jest.clearAllMocks();
  setUpAppData();
});

describe('reminderTimes (F13)', () => {
  it('starts today when today is not played and the time is still ahead', () => {
    const times = reminderTimes(at(17, 9), 19, 0, false);
    expect(times).toHaveLength(REMINDER_DAYS);
    expect(times[0]).toEqual(at(17, 19));
    expect(times[6]).toEqual(at(23, 19));
  });

  // The fix: a day whose dice are already done gets no reminder.
  it('skips today when today is already played', () => {
    const times = reminderTimes(at(17, 9), 19, 0, true);
    expect(times[0]).toEqual(at(18, 19));
    expect(times).toHaveLength(REMINDER_DAYS);
  });

  it('skips today once the time has passed', () => {
    expect(reminderTimes(at(17, 19, 0), 19, 0, false)[0]).toEqual(at(18, 19));
    expect(reminderTimes(at(17, 21), 19, 0, false)[0]).toEqual(at(18, 19));
  });

  it('crosses the end of the month', () => {
    expect(reminderTimes(at(31, 22), 8, 0, false)[0]).toEqual(new Date(2026, 10, 1, 8, 0));
  });
});

describe('scheduling', () => {
  it('replaces earlier reminders with one-off notifications for the coming days', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
      { identifier: 'daily-dice-reminder-2026-10-16' },
      { identifier: 'something-else' },
    ]);
    expect(await enableDailyReminder(19, 0, text, true, at(17, 9))).toBe(true);
    const cancelled = (Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls.map(([id]) => id);
    // Old one-offs and the repeating reminder of earlier versions go; other notifications stay.
    expect(cancelled.sort()).toEqual(['daily-dice-reminder', 'daily-dice-reminder-2026-10-16']);
    expect(scheduledDates()[0]).toEqual(at(18, 19));
    expect(scheduledDates()).toHaveLength(REMINDER_DAYS);
  });

  it('does not turn on without permission', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    expect(await enableDailyReminder(19, 0, text, false)).toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('turning off cancels every reminder', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([{ identifier: 'daily-dice-reminder-2026-10-18' }]);
    await disableDailyReminder();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('daily-dice-reminder-2026-10-18');
  });
});

describe('refreshing from the saved setting', () => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  it('moves the next reminder to tomorrow once today is played', async () => {
    useSettingsStore.getState().update({ dailyReminder: { enabled: true, hour: 23, minute: 59 } });
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    const morning = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 6);

    await refreshReminderFromSettings(morning);
    expect(scheduledDates()[0].getDate()).toBe(today.getDate());

    jest.clearAllMocks();
    updateAppData((d) => ({ ...d, daily: { ...d.daily, results: { [todayKey]: 180 } } }));
    expect(playedToday(morning)).toBe(true);
    await refreshReminderFromSettings(morning);
    expect(scheduledDates()[0].getDate()).toBe(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getDate());
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  });

  it('does nothing when the reminder is off or permission was taken away', async () => {
    await refreshReminderFromSettings();
    useSettingsStore.getState().update({ dailyReminder: { enabled: true, hour: 19, minute: 0 } });
    await refreshReminderFromSettings();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
