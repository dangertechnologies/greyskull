import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, type } from '../theme';
import { Button } from './Button';

const SIZE = 240;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  remaining: number;
  total: number;
  onSkip(): void;
}

/** Full-screen rest countdown. Purely presentational: no timers, no state writes. */
export function RestRing({ remaining, total, onSkip }: Props) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <View style={styles.wrap} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <Text style={type.label}>Rest</Text>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.faint}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.text}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            strokeLinecap="round"
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <Text style={styles.seconds} accessibilityLabel={`${remaining} seconds remaining`}>
          {remaining}
        </Text>
      </View>
      <Button title="Skip" variant="link" onPress={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  seconds: { position: 'absolute', color: colors.text, fontSize: 72, fontWeight: '200' },
});
