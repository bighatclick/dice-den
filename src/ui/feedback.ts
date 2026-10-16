import * as Haptics from 'expo-haptics';
import { getAppData } from '../state/appData';

/** Haptics never block play: failures are ignored (specs.md F12). */
function enabled(): boolean {
  try {
    return getAppData().settings.haptics;
  } catch {
    return false;
  }
}

export function rollFeedback(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function holdFeedback(): void {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

export function scoreFeedback(): void {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
