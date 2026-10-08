jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return {
    SymbolView: (props: { name: unknown }) => (
      <View testID="symbol" accessibilityLabel={String(JSON.stringify(props.name))} />
    ),
  };
});
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: View, GlassContainer: View, isLiquidGlassAvailable: () => false };
});

// The store (imported by the theme) persists to AsyncStorage; use the in-memory mock everywhere.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Primitives read safe-area insets; without a provider in unit tests, use the library's mock (zero insets).
jest.mock('react-native-safe-area-context', () => {
  const real = jest.requireActual('react-native-safe-area-context');
  return { ...real, ...require('react-native-safe-area-context/jest/mock').default };
});

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => ''), setStringAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock('expo-file-system', () => ({ File: class { async text() { return ''; } } }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/summary.png') }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
