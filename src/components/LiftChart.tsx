import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { nearestIndex, scaleSeries } from '../chartMath';
import { useTheme } from '../design/theme';
import type { ChartRange, SeriesPoint } from '../series';
import { inRange } from '../series';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Text } from '../ui/Text';

const PAD_X = 12;
const RANGES: ChartRange[] = ['3M', '6M', '1Y', 'All'];

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Area chart of one value per session: first/last date, min/max labels, a dashed line at the current value,
 * larger dots on personal records, range chips, and scrubbing (drag across the chart to read a session).
 */
export function LiftChart({
  points,
  format,
  label,
  height = 200,
  now = new Date(),
}: {
  points: SeriesPoint[];
  format(value: number): string;
  label: string;
  height?: number;
  now?: Date;
}) {
  const t = useTheme();
  const [range, setRange] = useState<ChartRange>('All');
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const visible = useMemo(() => inRange(points, range, now), [points, range, now]);
  const scaled = useMemo(
    () =>
      visible.length > 0
        ? scaleSeries(
            visible.map((p) => p.value),
            width,
            height,
            PAD_X,
          )
        : null,
    [visible, width, height],
  );

  const geometry = useRef({ points: scaled?.points ?? [] });
  geometry.current = { points: scaled?.points ?? [] };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setScrub(nearestIndex(geometry.current.points, e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setScrub(nearestIndex(geometry.current.points, e.nativeEvent.locationX)),
      onPanResponderRelease: () => setScrub(null),
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  const shown = scrub !== null ? visible[scrub] : visible[visible.length - 1];
  const summary = visible.length
    ? `${label}: ${format(Math.min(...visible.map((p) => p.value)))} to ${format(Math.max(...visible.map((p) => p.value)))} over ${visible.length} ${visible.length === 1 ? 'session' : 'sessions'}`
    : `${label}: no sessions yet`;

  const header = (
    <View style={{ minHeight: 48, gap: t.space[1] }}>
      <Text variant="numberLarge">{shown ? format(shown.value) : '–'}</Text>
      <Text variant="caption" color="textMuted">
        {shown
          ? `${shortDate(shown.date)}${shown.reps ? ` · ${shown.reps} reps` : ''}${shown.pr ? ' · PR' : ''}`
          : 'No finished sessions yet'}
      </Text>
    </View>
  );

  // One point is not a trend: a flat line with the same label top and bottom reads as a broken chart.
  if (points.length < 2) {
    return (
      <View style={{ gap: t.space[4] }} accessibilityLabel={summary}>
        {header}
        <Text variant="callout" color="textMuted">
          The chart starts after 2 workouts.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: t.space[4] }}>
      {header}

      <View
        accessible
        accessibilityLabel={summary}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height }}
        {...pan.panHandlers}
      >
        {scaled && width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Line
              x1={PAD_X}
              y1={height - PAD_X}
              x2={width - PAD_X}
              y2={height - PAD_X}
              stroke={t.color.border}
              strokeWidth={1}
            />
            <Line
              x1={PAD_X}
              x2={width - PAD_X}
              y1={scaled.points[scaled.points.length - 1].y}
              y2={scaled.points[scaled.points.length - 1].y}
              stroke={t.color.textMuted}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <Polygon
              points={[
                `${scaled.points[0].x},${height - PAD_X}`,
                ...scaled.points.map((p) => `${p.x},${p.y}`),
                `${scaled.points[scaled.points.length - 1].x},${height - PAD_X}`,
              ].join(' ')}
              fill={t.color.chartFill}
            />
            {scaled.points.length > 1 ? (
              <Polyline
                points={scaled.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={t.color.accent}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            ) : null}
            {scaled.points.map((p, i) => (
              <Circle
                key={visible[i].n}
                cx={p.x}
                cy={p.y}
                r={visible[i].pr ? 5 : 3}
                fill={visible[i].pr ? t.color.accent : t.color.surface}
                stroke={t.color.accent}
                strokeWidth={visible[i].pr ? 0 : 1.5}
              />
            ))}
            {scrub !== null ? (
              <Line
                x1={scaled.points[scrub].x}
                x2={scaled.points[scrub].x}
                y1={0}
                y2={height - PAD_X}
                stroke={t.color.textMuted}
                strokeWidth={1}
              />
            ) : null}
          </Svg>
        ) : null}
        {scaled ? (
          <>
            <Text variant="caption" color="textMuted" style={{ position: 'absolute', top: 0, right: 0 }}>
              {format(scaled.max)}
            </Text>
            <Text variant="caption" color="textMuted" style={{ position: 'absolute', bottom: 22, right: 0 }}>
              {format(scaled.min)}
            </Text>
          </>
        ) : null}
      </View>

      {visible.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textMuted">
            {shortDate(visible[0].date)}
          </Text>
          <Text variant="caption" color="textMuted">
            {shortDate(visible[visible.length - 1].date)}
          </Text>
        </View>
      ) : null}

      <SegmentedControl
        accessibilityLabel="Time range"
        options={RANGES.map((r) => ({ value: r, label: r }))}
        value={range}
        onChange={(v) => setRange(v as ChartRange)}
      />
    </View>
  );
}
