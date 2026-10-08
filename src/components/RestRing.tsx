import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BACKGROUNDS } from '../backgrounds';
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
  /** What comes after the rest, e.g. "Set 3 of 5 · 20 kg × 5". */
  next?: string;
}

/** Full-screen rest countdown. Purely presentational: no timers, no state writes. */
export function RestRing({ remaining, total, onSkip, next }: Props) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <ImageBackground
      source={BACKGROUNDS.rest}
      resizeMode="cover"
      style={styles.wrap}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      {/* Opaque: the set screen underneath must not show through the countdown. */}
      <View style={styles.scrim} />
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
      {next ? <Text style={[type.body, styles.next]}>{`Next: ${next}`}</Text> : null}
      <View style={styles.skip}>
        <Button title="Skip rest" onPress={onSkip} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 32,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  next: { textAlign: 'center' },
  skip: { alignSelf: 'stretch' },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  seconds: { position: 'absolute', color: colors.text, fontSize: 72, fontWeight: '200' },
});
