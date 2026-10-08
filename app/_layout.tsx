import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitle: '',
        contentStyle: { backgroundColor: '#000' },
      }}
    />
  );
}
