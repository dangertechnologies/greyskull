import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { type StepConfig, stepValue } from '../stepperLogic';
import { Icon } from './Icon';
import { Text } from './Text';

export const LONG_PRESS_MS = 400;
export const REPEAT_MS = 150;

interface Props extends StepConfig {
  value: number;
  onChange(value: number): void;
  format(value: number): string;
  label?: string;
  /** Large controls (64) and the 40 pt numeral, for reps and weights in a session. */
  size?: 'md' | 'lg';
  /** A settings row: label on the left, smaller controls on the right. */
  inline?: boolean;
}

/** Tap = exactly one step. Holding for 400 ms repeats every 150 ms until release. Screen readers get actions. */
export function NumberStepper({
  value,
  onChange,
  format,
  label,
  size = 'md',
  inline = false,
  ...config
}: Props) {
  const t = useTheme();
  const latest = useRef({ value, onChange, config });
  latest.current = { value, onChange, config };
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const step = (dir: 1 | -1) => {
    const { value: v, onChange: change, config: c } = latest.current;
    const next = stepValue(v, dir, c);
    if (next !== v) {
      latest.current.value = next; // the next repeat tick starts from here, before React re-renders
      haptics.tick();
      change(next);
    }
  };
  const startRepeat = (dir: 1 | -1) => {
    stop();
    step(dir);
    timer.current = setInterval(() => step(dir), REPEAT_MS);
  };

  const box = inline ? 44 : size === 'lg' ? 64 : 56;
  const button = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? 'Increase' : 'Decrease'}
      delayLongPress={LONG_PRESS_MS}
      onPress={() => step(dir)}
      onLongPress={() => startRepeat(dir)}
      onPressOut={stop}
      style={({ pressed }) => ({
        width: box,
        height: box,
        borderRadius: box / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.color.surfaceRaised : t.color.surface,
        borderWidth: 1,
        borderColor: t.color.borderStrong,
      })}
    >
      <Icon name={dir === 1 ? 'add' : 'remove'} size={inline ? 20 : size === 'lg' ? 28 : 24} />
    </Pressable>
  );

  return (
    <View style={inline ? [styles.inline, { gap: t.space[3] }] : [styles.wrap, { gap: t.space[2] }]}>
      {label ? (
        <Text
          variant={inline ? 'bodyStrong' : 'label'}
          color={inline ? 'text' : 'textMuted'}
          style={inline ? { flex: 1 } : undefined}
        >
          {label}
        </Text>
      ) : null}
      <View style={[styles.row, { gap: t.space[inline ? 2 : 4] }]}>
        {button(-1)}
        <Text
          variant={size === 'lg' ? 'numberLarge' : 'headline'}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: format(value) }}
          // Screen readers adjust with swipe up/down instead of hunting for the +/− buttons.
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ minWidth: inline ? 72 : 112, textAlign: 'center' }}
        >
          {format(value)}
        </Text>
        {button(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
