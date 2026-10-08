import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { scaleSeries } from '../chartMath';
import { colors, type } from '../theme';

interface Props {
  values: number[];
  format(value: number): string;
  height?: number;
  label: string;
}

const PAD = 14;

/** Line chart of one value per finished session; y-axis shows the min and max only. */
export function Chart({ values, format, height = 180, label }: Props) {
  const [width, setWidth] = useState(0);
  if (values.length === 0) {
    return <Text style={type.small}>No finished sessions yet.</Text>;
  }
  const { points, min, max } = scaleSeries(values, width, height, PAD);
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${format(min)} to ${format(max)} over ${values.length} ${values.length === 1 ? 'session' : 'sessions'}`}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={PAD}
            y1={height - PAD}
            x2={width - PAD}
            y2={height - PAD}
            stroke={colors.faint}
            strokeWidth={1}
          />
          {points.length > 1 ? (
            <Polyline points={line} fill="none" stroke={colors.text} strokeWidth={1.5} />
          ) : null}
          {points.map((p) => (
            <Circle key={p.x} cx={p.x} cy={p.y} r={3.5} fill={colors.text} />
          ))}
        </Svg>
      ) : null}
      <Text style={[type.small, styles.max]}>{format(max)}</Text>
      <Text style={[type.small, styles.min]}>{format(min)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  max: { position: 'absolute', top: 0, left: 0 },
  min: { position: 'absolute', bottom: 0, left: 0 },
});
