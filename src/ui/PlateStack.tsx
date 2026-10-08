import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../design/theme';
import type { PlateInventory, Unit } from '../domain';
import { formatPlates, platesPerSide } from '../domain';
import { useInventory, useUnit } from '../store';
import { Text } from './Text';

interface PlateStyle {
  color: string;
  height: number; // % of the tallest plate
}

// Data colours (IWF/IPF convention for kg, neutral greys for lb which has no standard): the only literal
// colours outside the theme, allowlisted in src/design/no-literal-colours.test.ts.
const KG: [number, PlateStyle][] = [
  [25, { color: '#D32F2F', height: 100 }],
  [20, { color: '#1565C0', height: 100 }],
  [15, { color: '#F9A825', height: 100 }],
  [10, { color: '#2E7D32', height: 100 }],
  [5, { color: '#ECEFF1', height: 70 }],
  [2.5, { color: '#D32F2F', height: 55 }],
  [1.25, { color: '#B0BEC5', height: 45 }],
  [0, { color: '#90A4AE', height: 35 }],
];
const LB: [number, PlateStyle][] = [
  [45, { color: '#455A64', height: 100 }],
  [35, { color: '#546E7A', height: 100 }],
  [25, { color: '#607D8B', height: 92 }],
  [10, { color: '#78909C', height: 70 }],
  [5, { color: '#90A4AE', height: 55 }],
  [2.5, { color: '#B0BEC5', height: 45 }],
  [1.25, { color: '#CFD8DC', height: 40 }],
  [0, { color: '#CFD8DC', height: 35 }],
];

/** Style for a plate: the closest catalogue entry at or below its weight. */
export function plateStyle(plate: number, unit: Unit): PlateStyle {
  const table = unit === 'kg' ? KG : LB;
  return (table.find(([w]) => plate >= w) ?? table[table.length - 1])[1];
}

/**
 * One side of the bar, plates largest first, with the text line underneath (colour is never the only carrier).
 * `size="sm"` is the compact variant for list rows.
 */
export function PlateStack({
  kg,
  size = 'lg',
  unit: unitProp,
  inventory: inventoryProp,
}: {
  kg: number;
  size?: 'sm' | 'lg';
  unit?: Unit;
  inventory?: PlateInventory;
}) {
  const t = useTheme();
  const storeUnit = useUnit();
  const storeInventory = useInventory();
  const unit = unitProp ?? storeUnit;
  const inventory = inventoryProp ?? storeInventory;
  const plates = platesPerSide(kg, inventory, unit);
  const label = formatPlates(kg, inventory, unit);

  const H = size === 'lg' ? 56 : 24;
  const plateW = size === 'lg' ? 12 : 6;
  const gap = size === 'lg' ? 3 : 2;
  const stub = size === 'lg' ? 28 : 12;
  const width = stub + plates.length * (plateW + gap) + gap;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ gap: t.space[2], alignItems: size === 'lg' ? 'flex-start' : 'flex-end' }}
    >
      {/* Bar only: the caption says so; a lone sleeve stub read as a stray dash. */}
      {plates.length === 0 ? null : (
        <Svg width={width} height={H}>
          <Rect x={0} y={H / 2 - 2} width={width} height={4} rx={2} fill={t.color.borderStrong} />
          {plates.map((p, i) => {
            const s = plateStyle(p, unit);
            const h = (H * s.height) / 100;
            return (
              <Rect
                // biome-ignore lint/suspicious/noArrayIndexKey: plates repeat (two 20s); position is the identity
                key={i}
                x={stub + i * (plateW + gap)}
                y={(H - h) / 2}
                width={plateW}
                height={h}
                rx={2}
                fill={s.color}
                stroke={t.color.borderStrong}
                strokeWidth={0.75}
              />
            );
          })}
        </Svg>
      )}
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}
