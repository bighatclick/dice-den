import * as Notifications from 'expo-notifications';

/** Every reminder this app schedules has an identifier starting with this (one per day). */
const REMINDER_PREFIX = 'daily-dice-reminder';
/** How many days ahead are scheduled, so reminders keep coming even if the app is not opened. */
export const REMINDER_DAYS = 7;

export interface ReminderText {
  title: string;
  body: string;
}

/**
 * When the next reminders should fire (specs.md F13): one a day at the player's time,
 * but never on a day whose dice are already done. Today counts only if it is not played
 * yet and the time has not passed.
 */
export function reminderTimes(now: Date, hour: number, minute: number, playedToday: boolean, days = REMINDER_DAYS): Date[] {
  const times: Date[] = [];
  for (let i = 0; times.length < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
    if (i === 0 && (playedToday || at.getTime() <= now.getTime())) continue;
    times.push(at);
  }
  return times;
}

async function cancelAll(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const ids = new Set(scheduled.map((n) => n.identifier).filter((id) => id.startsWith(REMINDER_PREFIX)));
  // The repeating reminder from earlier versions used the bare prefix as its identifier.
  ids.add(REMINDER_PREFIX);
  await Promise.all([...ids].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

async function schedule(times: Date[], text: ReminderText): Promise<void> {
  await cancelAll();
  for (const at of times) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}-${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
      content: { title: text.title, body: text.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

/**
 * Turns the opt-in daily reminder on, asking for permission if needed. Returns whether it is on.
 * `playedToday` skips today when its dice are already done.
 */
export async function enableDailyReminder(
  hour: number,
  minute: number,
  text: ReminderText,
  playedToday: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    await schedule(reminderTimes(now, hour, minute, playedToday), text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reschedules an enabled reminder without asking for anything: after today's dice are
 * done, and whenever the app opens. Never throws; does nothing if permission was taken away.
 */
export async function refreshDailyReminder(
  hour: number,
  minute: number,
  text: ReminderText,
  playedToday: boolean,
  now: Date = new Date(),
): Promise<void> {
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await schedule(reminderTimes(now, hour, minute, playedToday), text);
  } catch {
    // A reminder must never get in the way of play.
  }
}

export async function disableDailyReminder(): Promise<void> {
  await cancelAll().catch(() => {});
}
