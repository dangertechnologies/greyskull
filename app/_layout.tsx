import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StorageRecovery } from '../src/components/StorageRecovery';
import { useAppFonts } from '../src/design/fonts';
import { ThemeProvider, useTheme } from '../src/design/theme';
import { startHealthSync } from '../src/health';
import { AppIntentsBridge } from '../src/intents/Bridge';
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
      <AppIntentsBridge />
    </SnackbarProvider>
  );
}

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  const storageError = useStore((s) => s.storageError);
  const fontsReady = useAppFonts();

  useEffect(() => {
    void initStore();
  }, []);
  useEffect(() => watchStoreForWidgets(useStore), []);
  // Only on data that loaded and is writable: the sync reads the history and writes Health ids back into it.
  const storageHealthy = hydrated && !storageError;
  useEffect(() => (storageHealthy ? startHealthSync() : undefined), [storageHealthy]);
  const ready = hydrated && fontsReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return <ThemeProvider>{storageError ? <StorageRecovery error={storageError} /> : <Shell />}</ThemeProvider>;
}
