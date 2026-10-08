import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAppFonts } from '../src/design/fonts';
import { ThemeProvider, useTheme } from '../src/design/theme';
import { useStackOptions } from '../src/navigation';
import { initStore, useStore } from '../src/store';
import { SnackbarProvider } from '../src/ui/Snackbar';
import { watchStoreForWidgets } from '../src/widgets';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const t = useTheme();
  const options = useStackOptions();
  return (
    <SnackbarProvider>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={options}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/[n]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack>
    </SnackbarProvider>
  );
}

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  const fontsReady = useAppFonts();

  useEffect(() => {
    void initStore();
  }, []);
  useEffect(() => watchStoreForWidgets(useStore), []);
  const ready = hydrated && fontsReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
