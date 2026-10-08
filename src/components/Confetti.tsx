import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReduceMotion } from '../design/motion';
import { useTheme } from '../design/theme';

export interface Piece {
  /** 0–1 across the screen width */
  x: number;
  /** px sideways drift while falling */
  drift: number;
  size: number;
  delay: number;
  duration: number;
  /** turns while falling */
  spin: number;
  colour: number;
}

/** Deterministic pseudo-random pieces (same layout every run, so it is testable and never flickers). */
export function makePieces(count: number, palette: number): Piece[] {
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: rnd(),
    drift: (rnd() - 0.5) * 120,
    size: 6 + Math.round(rnd() * 6),
    delay: Math.round(rnd() * 500),
    duration: 1800 + Math.round(rnd() * 1400),
    spin: 1 + rnd() * 3,
    colour: Math.floor(rnd() * palette),
  }));
}

/** One-shot burst for a finished workout. Renders nothing under Reduce Motion. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduce = useReduceMotion();
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const palette = [t.color.accent, t.color.success, t.color.warning, t.color.onPhoto];
  const pieces = useMemo(() => makePieces(count, palette.length), [count, palette.length]);
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduce) return;
    const runs = pieces.map((p, i) =>
      Animated.timing(progress[i], {
        toValue: 1,
        delay: p.delay,
        duration: p.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const all = Animated.parallel(runs);
    all.start();
    return () => all.stop();
  }, [reduce, pieces, progress]);

  if (reduce) return null;
  return (
    <View
      pointerEvents="none"
      testID="confetti"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((p, i) => (
        <Animated.View
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed, never reordered
          key={i}
          style={{
            position: 'absolute',
            left: p.x * width,
            top: -20,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: palette[p.colour],
            opacity: progress[i].interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.7] }) },
              { translateX: progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              {
                rotate: progress[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${p.spin * 360}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
