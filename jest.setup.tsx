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
  return { GlassView: View, GlassContainer: View, isLiquidGlassAvailable: jest.fn(() => false) };
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
// An in-memory file system: `__files` maps uri → text (tests clear it or put files in it).
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return files.has(this.uri);
    }
    get name() {
      return this.uri.split('/').pop() as string;
    }
    async text() {
      return files.get(this.uri) ?? '';
    }
    async write(content: string) {
      files.set(this.uri, String(content));
    }
    async move(to: File, options?: { overwrite?: boolean }) {
      if (!files.has(this.uri)) throw new Error(`No file ${this.uri}`);
      if (files.has(to.uri) && !options?.overwrite) throw new Error(`${to.uri} exists`);
      files.set(to.uri, files.get(this.uri) as string);
      files.delete(this.uri);
      this.uri = to.uri;
    }
    async copy(to: File, options?: { overwrite?: boolean }) {
      if (!files.has(this.uri)) throw new Error(`No file ${this.uri}`);
      if (files.has(to.uri) && !options?.overwrite) throw new Error(`${to.uri} exists`);
      files.set(to.uri, files.get(this.uri) as string);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  const Paths = {
    document: {
      uri: 'file:///documents',
      list: () => [...files.keys()].filter((u) => u.startsWith('file:///documents/')).map((u) => new File(u)),
    },
  };
  return { File, Paths, __files: files };
});
// Every test starts with an empty file system, as each starts with empty AsyncStorage in its own setup.
beforeEach(() => {
  (jest.requireMock('expo-file-system') as { __files: Map<string, string> }).__files.clear();
});
// expo-constants needs the native launcher module; the app config reads nothing special in tests.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/summary.png') }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));
// Siri and Shortcuts: the native module does not exist in tests. Report it unavailable, with inert subscriptions.
jest.mock('expo-app-intents', () => ({
  isAvailable: jest.fn(() => false),
  useAppIntents: jest.fn(),
  addAppIntentListener: jest.fn(() => ({ remove: jest.fn() })),
  setEntityCatalogAsync: jest.fn(async () => undefined),
  getPendingInvocationsAsync: jest.fn(async () => []),
  removePendingInvocationAsync: jest.fn(async () => undefined),
}));
