import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'daily-dice-reminder';

/**
 * Opt-in daily reminder (specs.md F13): one local notification a day at the
 * player's time, only about today's dice, never marketing. Returns whether it is on.
 */
export async function enableDailyReminder(hour: number, minute: number, text: { title: string; body: string }): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: text.title, body: text.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return true;
  } catch {
    return false;
  }
}

export async function disableDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}
