import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { stackScreenOptions } from '../src/navigation';
import { initStore, useStore } from '../src/store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    void initStore();
  }, []);
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  if (!hydrated) return null;
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="session/[n]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
    </Stack>
  );
}
