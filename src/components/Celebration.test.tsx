import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { AccessibilityInfo } from 'react-native';
import { builtInExercises } from '../catalog';
import { ThemeProvider } from '../design/theme';
import { Celebration } from './Celebration';
import { Confetti, makePieces } from './Confetti';

// Rendered outside a navigator here; in the app it always has one.
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useIsFocused: () => true }));

const ex = builtInExercises();
const line = (change: 'up' | 'same') => ({
  exercise: ex.BENCH_PRESS,
  fromKg: 40,
  pr: false,
  outcome: { change, next: { weightKg: 42.5, startKg: 40, fails: 0 } } as never,
});

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('Confetti', () => {
  test('pieces are deterministic and within bounds', () => {
    const a = makePieces(20, 4);
    expect(a).toEqual(makePieces(20, 4));
    expect(a.every((p) => p.x >= 0 && p.x < 1 && p.colour >= 0 && p.colour < 4)).toBe(true);
  });

  test('renders by default and not under Reduce Motion', async () => {
    wrap(<Confetti />);
    expect(await screen.findByTestId('confetti', { includeHiddenElements: true })).toBeTruthy();
    screen.unmount();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    wrap(<Confetti />);
    await act(async () => undefined);
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
  });
});

describe('Celebration', () => {
  test('confetti only after a progression, and the summary can be shared as an image', async () => {
    const onHome = jest.fn();
    wrap(<Celebration lines={[line('up')]} unit="kg" onHome={onHome} />);
    expect(await screen.findByTestId('confetti', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-summary'));
    });
    await waitFor(() =>
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///tmp/summary.png',
        expect.objectContaining({ mimeType: 'image/png' }),
      ),
    );
    screen.unmount();
    wrap(<Celebration lines={[line('same')]} unit="kg" onHome={onHome} />);
    await act(async () => undefined);
    expect(screen.queryByTestId('confetti', { includeHiddenElements: true })).toBeNull();
  });
});
