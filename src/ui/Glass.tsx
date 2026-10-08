import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';

/** True when iOS 26 Liquid Glass can be used: available on this OS and the user has not asked for less transparency. */
export function useGlass(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return Platform.OS === 'ios' && !reduce && isLiquidGlassAvailable();
}

/**
 * Fills its parent with a glass pane when available; otherwise renders nothing and the caller's solid
 * background shows through (callers pick their fallback colour via `useGlass`).
 */
export function GlassPane() {
  return <GlassView pointerEvents="none" glassEffectStyle="regular" style={StyleSheet.absoluteFill} />;
}
