import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../state/settingsStore';
import { playSound } from './sound';

/** Sound and haptics never block play: failures are ignored (specs.md F12). */
function enabled(): boolean {
  return useSettingsStore.getState().settings.haptics;
}

export function rollFeedback(): void {
  playSound('roll');
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function holdFeedback(): void {
  playSound('hold');
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

export function scoreFeedback(yatzy = false): void {
  playSound(yatzy ? 'yatzy' : 'score');
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
