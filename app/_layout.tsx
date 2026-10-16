import '../src/i18n/i18n';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getRepository } from '../src/data/mmkvStore';
import { initAppData } from '../src/state/appData';
import { useGameStore } from '../src/state/gameStore';
import { denFonts } from '../src/ui/fonts';
import { ThemeProvider, useTheme } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync();

// Load saved data (migrating if needed) before any screen reads a store.
initAppData(getRepository());
useGameStore.getState().hydrate();

export default function RootLayout() {
  const [loaded, error] = useFonts(denFonts);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
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
