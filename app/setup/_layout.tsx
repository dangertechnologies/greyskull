import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../src/navigation';
import { SetupProvider } from '../../src/setup/SetupContext';

export default function SetupLayout() {
  return (
    <SetupProvider>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </SetupProvider>
  );
}
