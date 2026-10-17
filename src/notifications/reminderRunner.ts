import { AppState } from 'react-native';
import { toDateKey } from '../engine/rng';
import i18n from '../i18n/i18n';
import { getAppData } from '../state/appData';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { refreshDailyReminder, type ReminderText } from './reminder';

export function reminderText(): ReminderText {
  return { title: i18n.t('reminder.title'), body: i18n.t('reminder.body') };
}

/** Whether today's dice are already done, so today's reminder is skipped. */
export function playedToday(now: Date = new Date()): boolean {
  return getAppData().daily.results[toDateKey(now)] !== undefined;
}

/** Reschedules the reminder from the saved setting; does nothing when it is off. */
export function refreshReminderFromSettings(now: Date = new Date()): Promise<void> {
  const { enabled, hour, minute } = useSettingsStore.getState().settings.dailyReminder;
  if (!enabled) return Promise.resolve();
  return refreshDailyReminder(hour, minute, reminderText(), playedToday(now), now);
}

/**
 * Keeps the reminder in step with play: now, whenever the app comes to the front
 * (a new day may have started), and the moment a daily game is finished.
 */
export function startReminderRefresh(): () => void {
  void refreshReminderFromSettings();
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshReminderFromSettings();
  });
  const offGame = useGameStore.subscribe((s, prev) => {
    const finishedDaily = s.game?.mode === 'daily' && s.game.status === 'finished' && prev.game?.status === 'playing';
    if (finishedDaily) void refreshReminderFromSettings();
  });
  return () => {
    appState.remove();
    offGame();
  };
}
