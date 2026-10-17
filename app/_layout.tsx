import '../src/i18n/i18n';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getRepository } from '../src/data/mmkvStore';
import { initAppData } from '../src/state/appData';
import { startCloudSync } from '../src/state/cloudSyncRunner';
import { recordSession } from '../src/state/session';
import { useGameStore } from '../src/state/gameStore';
import { useSettings, useSettingsStore } from '../src/state/settingsStore';
import { denFonts } from '../src/ui/fonts';
import { ThemeProvider, useTheme } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync();

// Load saved data (migrating if needed) before any screen reads a store.
initAppData(getRepository());
recordSession();
useGameStore.getState().hydrate();
useSettingsStore.getState().hydrate();

export default function RootLayout() {
  const [loaded, error] = useFonts(denFonts);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  // iCloud key-value sync of settings, stats summary, unlocks and streak (iOS only).
  useEffect(() => startCloudSync(), []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsTheme>
          <ThemedStack />
        </SettingsTheme>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Dark mode follows Settings › Appearance (System, Light or Dark). */
function SettingsTheme({ children }: { children: ReactNode }) {
  const { themeMode } = useSettings();
  return <ThemeProvider mode={themeMode}>{children}</ThemeProvider>;
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="game" options={{ gestureEnabled: false }} />
        <Stack.Screen name="final" options={{ gestureEnabled: false }} />
        <Stack.Screen name="new-game" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
