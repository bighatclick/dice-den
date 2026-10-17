import { updateAppData } from '../state/appData';

/**
 * Shows the system App Tracking Transparency prompt after the soft prompt.
 * Declining only means non-personalised ads. Recorded so it is asked once.
 */
export async function requestTracking(): Promise<void> {
  updateAppData((d) => ({ ...d, ads: { ...d.ads, attPrompted: true } }));
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const att = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
    if (att.isAvailable()) await att.requestTrackingPermissionsAsync();
  } catch {
    // No native module (Expo Go): nothing to ask.
  }
}
