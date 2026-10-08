import { Stack } from 'expo-router';
import { useStackOptions } from '../../src/navigation';
import { SetupProvider } from '../../src/setup/SetupContext';

export default function SetupLayout() {
  const options = useStackOptions();
  return (
    <SetupProvider>
      <Stack screenOptions={options}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </SetupProvider>
  );
}
