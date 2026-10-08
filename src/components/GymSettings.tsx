import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { PlateInventory, Unit } from '../domain';
import { BAR_OPTIONS, DEFAULT_INVENTORY, OPTIONAL_PLATES, smallestStep, trim } from '../domain';
import { Chip } from '../ui/Chip';
import { Section } from '../ui/Section';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Text } from '../ui/Text';

interface Props {
  unit: Unit;
  inventory: PlateInventory;
  onUnitChange(unit: Unit): void;
  onInventoryChange(patch: Partial<PlateInventory>): void;
}

/** Unit + "your gym": bar weight and the plate sizes available. Shared by Settings and Setup. */
export function GymSettings({ unit, inventory, onUnitChange, onInventoryChange }: Props) {
  const t = useTheme();
  const bar = unit === 'kg' ? inventory.barKg : inventory.barLb;
  const owned = unit === 'kg' ? inventory.platesKg : inventory.platesLb;
  const defaults = unit === 'kg' ? DEFAULT_INVENTORY.platesKg : DEFAULT_INVENTORY.platesLb;
  const options = [...new Set([...defaults, ...OPTIONAL_PLATES[unit]])].sort((a, b) => b - a);
  const setPlates = (plates: number[]) =>
    onInventoryChange(unit === 'kg' ? { platesKg: plates } : { platesLb: plates });
  const toggle = (p: number) =>
    setPlates(owned.includes(p) ? owned.filter((x) => x !== p) : [...owned, p].sort((a, b) => b - a));
  const jump = smallestStep(inventory, unit);
  const wrap = { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] } as const;

  return (
    <View style={{ gap: t.space[8] }}>
      <Section label="Unit">
        <SegmentedControl
          accessibilityLabel="Unit"
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={unit}
          onChange={(v) => onUnitChange(v as Unit)}
        />
      </Section>
      <Section label="Barbell">
        <View style={wrap}>
          {BAR_OPTIONS[unit].map((b) => (
            <Chip
              key={b}
              label={`${b} ${unit}`}
              selected={bar === b}
              onPress={() => onInventoryChange(unit === 'kg' ? { barKg: b } : { barLb: b })}
            />
          ))}
        </View>
      </Section>
      <Section
        label="Plates (per side)"
        footer={
          jump > 0 ? `Smallest jump: ${trim(jump)} ${unit}` : 'No plates selected: you can only lift the bar'
        }
      >
        <View style={wrap}>
          {options.map((p) => (
            <Chip
              key={p}
              role="checkbox"
              label={trim(p)}
              selected={owned.includes(p)}
              onPress={() => toggle(p)}
            />
          ))}
        </View>
      </Section>
      <Text variant="caption" color="textMuted">
        Weights you are offered are always ones you can load with these plates.
      </Text>
    </View>
  );
}
