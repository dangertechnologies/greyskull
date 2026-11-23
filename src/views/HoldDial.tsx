import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../design/theme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import type { Stopwatch } from './useStopwatch';

const SIZE = 200;
const STROKE = 10;

/** "0:18" */
export const clockLabel = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Ring filling towards the target, the time held, and Start / Pause / Resume / Reset. */
export function HoldDial({ watch, targetS }: { watch: Stopwatch; targetS: number | null }) {
  const t = useTheme();
  const r = (SIZE - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const done = targetS ? Math.min(1, watch.seconds / targetS) : 0;
  const paused = !watch.running && watch.seconds > 0;
  return (
    <View style={{ alignItems: 'center', gap: t.space[4] }}>
      <View
        accessible
        accessibilityRole="timer"
        accessibilityLabel={`Held ${watch.seconds} seconds${targetS ? ` of ${targetS}` : ''}`}
        style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke={t.color.border}
            strokeWidth={STROKE}
            fill="none"
          />
          {done > 0 ? (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={t.color.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${length * done} ${length}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ) : null}
        </Svg>
        <Text variant="display" testID="hold-time">
          {clockLabel(watch.seconds)}
        </Text>
        {targetS ? (
          <Text variant="callout" color="textMuted">
            {`Target ${targetS} s`}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: t.space[3], alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <Button
            title={watch.running ? 'Pause' : paused ? 'Resume' : 'Start hold'}
            icon="timer"
            variant="secondary"
            testID="hold-toggle"
            onPress={watch.running ? watch.pause : watch.start}
          />
        </View>
        {paused ? (
          <View style={{ flex: 1 }}>
            <Button title="Reset" variant="secondary" testID="hold-reset" onPress={watch.reset} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
