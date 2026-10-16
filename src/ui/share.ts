import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import { SHARE_CARD_SIZE, type ShareCardRef } from './ShareCard';

/** Captures the share card at 1080×1350 and opens the share sheet. Never throws. */
export async function shareCard(ref: RefObject<ShareCardRef | null>): Promise<boolean> {
  try {
    if (!ref.current || !(await Sharing.isAvailableAsync())) return false;
    // view-shot's types predate React Native's element refs; the ref is a host view.
    const uri = await captureRef(ref.current as unknown as number, {
      format: 'png',
      width: SHARE_CARD_SIZE.width * 3,
      height: SHARE_CARD_SIZE.height * 3,
      result: 'tmpfile',
    });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    return true;
  } catch {
    return false;
  }
}
