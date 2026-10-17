import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Light status bar text while a full-screen felt screen is focused (the felt is
 * dark in both themes). Rendered only while focused, so a screen pushed on top
 * (the final scorecard) falls back to the root style instead of white on cream.
 * A mounted <StatusBar> beats imperative calls, which the root one overwrites.
 */
export function LightStatusBar() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused ? <StatusBar style="light" /> : null;
}
