import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { stepValue } from '../stepperLogic';
import type { StepConfig } from '../stepperLogic';
import { colors, type } from '../theme';

export const LONG_PRESS_MS = 400;
export const REPEAT_MS = 150;

interface Props extends StepConfig {
  value: number;
  onChange(value: number): void;
  format(value: number): string;
  label?: string;
  /** Use the large numeral style (reps, weights in session views). */
  large?: boolean;
}

/** Tap = exactly one step. Holding for 400 ms repeats every 150 ms until release. */
export function Stepper({ value, onChange, format, label, large, ...config }: Props) {
  const latest = useRef({ value, onChange, config });
  latest.current = { value, onChange, config };
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const step = (dir: 1 | -1) => {
    const { value: v, onChange: change, config: c } = latest.current;
    const next = stepValue(v, dir, c);
    if (next !== v) {
      latest.current.value = next; // the next repeat tick must start from here, before React re-renders
      change(next);
    }
  };
  const startRepeat = (dir: 1 | -1) => {
    stop();
    step(dir);
    timer.current = setInterval(() => step(dir), REPEAT_MS);
  };

  const button = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? 'Increase' : 'Decrease'}
      delayLongPress={LONG_PRESS_MS}
      onPress={() => step(dir)}
      onLongPress={() => startRepeat(dir)}
      onPressOut={stop}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>{dir === 1 ? '+' : '−'}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={styles.row}>
        {button(-1)}
        <Text
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: format(value) }}
          // Screen readers adjust with swipe up/down instead of hunting for the +/− buttons.
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={[styles.value, large && type.big]}
        >
          {format(value)}
        </Text>
        {button(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  value: { color: colors.text, fontSize: 32, fontWeight: '200', minWidth: 110, textAlign: 'center' },
  button: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.faint },
  glyph: { color: colors.text, fontSize: 26, fontWeight: '200', lineHeight: 30 },
});
