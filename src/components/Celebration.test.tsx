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

describe('Celebration lines for calisthenics', () => {
  const base = { pr: false, fromKg: 0 };
  test('a ladder step change names the new step; a band change says lighter band', () => {
    wrap(
      <Celebration
        unit="kg"
        onHome={jest.fn()}
        lines={[
          {
            ...base,
            exercise: ex.CAL_ARCH_HANG,
            step: 'Negative pull-up',
            outcome: { change: 'up', next: { weightKg: 0, startKg: 0, fails: 0, step: 2 } },
          },
          {
            ...base,
            exercise: ex.CAL_PULLUP_BAND_ASSISTED,
            band: { label: 'Green', change: 'lighter' as const },
            outcome: { change: 'up', next: { weightKg: 0, startKg: 0, fails: 0, step: 3, bandId: 'g' } },
          },
        ]}
      />,
    );
    expect(screen.getByText('Step up: Negative pull-up')).toBeTruthy();
    expect(screen.getByText(`${ex.CAL_PULLUP_BAND_ASSISTED.name} · Lighter band: Green`)).toBeTruthy();
    screen.unmount();
    const band = (change: 'heavier' | 'start') => ({
      ...base,
      exercise: ex.CAL_PULLUP_BAND_ASSISTED,
      band: { label: 'Black', change },
      outcome: {
        change: 'deload' as const,
        next: { weightKg: 0, startKg: 0, fails: 0, step: 3, bandId: 'b' },
      },
    });
    wrap(<Celebration unit="kg" onHome={jest.fn()} lines={[band('heavier')]} />);
    expect(screen.getByText(`${ex.CAL_PULLUP_BAND_ASSISTED.name} · Heavier band: Black`)).toBeTruthy();
    screen.unmount();
    wrap(
      <Celebration
        unit="kg"
        onHome={jest.fn()}
        lines={[{ ...band('start'), outcome: { ...band('start').outcome, change: 'same' } }]}
      />,
    );
    expect(screen.getByText(`${ex.CAL_PULLUP_BAND_ASSISTED.name} · Band: Black`)).toBeTruthy();
    expect(screen.queryByText(/0 kg/)).toBeNull();
  });

  test('bodyweight shows added load or none; holds count seconds', () => {
    wrap(
      <Celebration
        unit="kg"
        onHome={jest.fn()}
        lines={[
          {
            ...base,
            exercise: ex.DIPS,
            outcome: { change: 'up', next: { weightKg: 2.5, startKg: 0, fails: 0 } },
          },
          {
            ...base,
            exercise: ex.CAL_ARCH_HANG,
            timed: true,
            outcome: { change: 'reps', next: { weightKg: 0, startKg: 0, fails: 0, reps: 15 } },
          },
        ]}
      />,
    );
    expect(screen.getByText(`${ex.DIPS.name} → +2.5 kg`)).toBeTruthy();
    expect(screen.getByText(`${ex.CAL_ARCH_HANG.name} · target 15 s`)).toBeTruthy();
    expect(screen.getByText('Longer hold next time')).toBeTruthy();
  });
});
