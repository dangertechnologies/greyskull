import Svg, { Circle, Polyline } from 'react-native-svg';
import { scaleSeries } from '../chartMath';
import { useTheme } from '../design/theme';

/** Tiny trend line (last 12 values) for list rows. Decorative: the row carries the numbers. */
export function Sparkline({
  values,
  width = 64,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const t = useTheme();
  const recent = values.slice(-12);
  if (recent.length < 2) return null;
  const { points } = scaleSeries(recent, width, height, 3);
  const last = points[points.length - 1];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no">
      <Polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={t.color.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={3} fill={t.color.accent} />
    </Svg>
  );
}
