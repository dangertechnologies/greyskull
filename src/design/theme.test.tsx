import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import { initialState, initStore, STORAGE_KEY, useStore } from '../store';
import { Text } from '../ui/Text';
import { setHapticsEnabled } from './haptics';
import { makeStyles, makeTheme, ThemeProvider, useTheme } from './theme';
import { palettes } from './tokens';

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

test('the appearance setting picks the palette; system follows the OS', async () => {
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.scheme).toBe('light');
  await act(async () => useStore.getState().setSettings({ appearance: 'dark' }));
  expect(result.current.scheme).toBe('dark');
  expect(result.current.color).toBe(palettes.dark);
  await act(async () => useStore.getState().setSettings({ appearance: 'light' }));
  expect(result.current.color.background).toBe(palettes.light.background);
});

test('a forced scheme wins over the setting (used by the gallery)', () => {
  const forced = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider forceScheme="light">{children}</ThemeProvider>
  );
  useStore.getState().setSettings({ appearance: 'dark' });
  expect(renderHook(() => useTheme(), { wrapper: forced }).result.current.scheme).toBe('light');
});

test('makeStyles creates the style object once per scheme', () => {
  const calls: string[] = [];
  const useStyles = makeStyles((t) => {
    calls.push(t.scheme);
    return { box: { backgroundColor: t.color.surface } };
  });
  const dark = renderHook(() => useStyles(), { wrapper });
  dark.rerender({});
  expect(calls).toHaveLength(1);
});

test('Text takes its colour from the theme role', () => {
  useStore.getState().setSettings({ appearance: 'light' });
  render(
    <ThemeProvider>
      <Text color="danger">Oops</Text>
    </ThemeProvider>,
  );
  expect(screen.getByText('Oops')).toHaveStyle({ color: palettes.light.danger });
});

test('new settings default for data saved before they existed', async () => {
  const old = { ...initialState() } as Partial<ReturnType<typeof initialState>>;
  delete old.appearance;
  delete old.hapticsEnabled;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: old, version: 2 }));
  await initStore();
  expect(useStore.getState().appearance).toBe('system');
  expect(useStore.getState().hapticsEnabled).toBe(true);
});

test('turning haptics off silences them', () => {
  const Haptics = require('expo-haptics');
  const spy = jest.spyOn(Haptics, 'selectionAsync').mockResolvedValue(undefined);
  const { haptics } = require('./haptics');
  setHapticsEnabled(false);
  haptics.tick();
  expect(spy).not.toHaveBeenCalled();
  setHapticsEnabled(true);
  haptics.tick();
  expect(spy).toHaveBeenCalledTimes(1);
});

describe('dynamic colour', () => {
  test('withAccent only swaps the accent pair', () => {
    const { withAccent } = require('./theme') as typeof import('./theme');
    const base = makeTheme('dark').color;
    const out = withAccent(base, 'A', 'B');
    expect(out.accent).toBe('A');
    expect(out.onAccent).toBe('B');
    expect(out.background).toBe(base.background);
  });

  test('is off outside Android 12+', () => {
    const { dynamicColorSupported } = require('./theme') as typeof import('./theme');
    expect(dynamicColorSupported()).toBe(false); // jest-expo defaults to iOS
  });
});
