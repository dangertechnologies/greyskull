import { render, screen } from '@testing-library/react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { AccessibilityInfo, Text } from 'react-native';
import { ThemeProvider } from '../design/theme';
import { BottomBar } from './layout';

const wrap = () =>
  render(
    <ThemeProvider>
      <BottomBar>
        <Text>Done</Text>
      </BottomBar>
    </ThemeProvider>,
  );

const glassView = () => screen.UNSAFE_queryAllByProps({ glassEffectStyle: 'regular' });

describe('BottomBar glass', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  });

  test('solid when Liquid Glass is unavailable', async () => {
    wrap();
    expect(glassView()).toHaveLength(0);
  });

  test('glass pane when available', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    wrap();
    expect(glassView().length).toBeGreaterThan(0);
  });

  test('falls back to solid under Reduce Transparency', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    wrap();
    await screen.findByText('Done');
    await new Promise((r) => setImmediate(r));
    expect(glassView()).toHaveLength(0);
  });
});
