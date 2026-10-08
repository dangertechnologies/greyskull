import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlateInventory, Unit } from '../domain';
import { BAR_OPTIONS, DEFAULT_INVENTORY, OPTIONAL_PLATES, smallestStep, trim } from '../domain';
import { colors, type } from '../theme';

interface Props {
  unit: Unit;
  inventory: PlateInventory;
  onUnitChange(unit: Unit): void;
  onInventoryChange(patch: Partial<PlateInventory>): void;
}

function Chip({
  label,
  selected,
  onPress,
  role = 'radio',
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Unit toggle + "your gym": bar weight and the plate sizes available. Shared by Settings and Setup. */
export function GymSettings({ unit, inventory, onUnitChange, onInventoryChange }: Props) {
  const bar = unit === 'kg' ? inventory.barKg : inventory.barLb;
  const owned = unit === 'kg' ? inventory.platesKg : inventory.platesLb;
  const defaults = unit === 'kg' ? DEFAULT_INVENTORY.platesKg : DEFAULT_INVENTORY.platesLb;
  const options = [...new Set([...defaults, ...OPTIONAL_PLATES[unit]])].sort((a, b) => b - a);
  const setPlates = (plates: number[]) =>
    onInventoryChange(unit === 'kg' ? { platesKg: plates } : { platesLb: plates });
  const toggle = (p: number) =>
    setPlates(owned.includes(p) ? owned.filter((x) => x !== p) : [...owned, p].sort((a, b) => b - a));
  const jump = smallestStep(inventory, unit);

  return (
    <View style={styles.wrap}>
      <Text style={type.label}>Unit</Text>
      <View style={styles.row}>
        <Chip label="kg" selected={unit === 'kg'} onPress={() => onUnitChange('kg')} />
        <Chip label="lb" selected={unit === 'lb'} onPress={() => onUnitChange('lb')} />
      </View>
      <Text style={type.label}>Your gym · bar weight</Text>
      <View style={styles.row}>
        {BAR_OPTIONS[unit].map((b) => (
          <Chip
            key={b}
            label={`${b} ${unit}`}
            selected={bar === b}
            onPress={() => onInventoryChange(unit === 'kg' ? { barKg: b } : { barLb: b })}
          />
        ))}
      </View>
      <Text style={type.label}>Plates (per side)</Text>
      <View style={styles.row}>
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
      <Text style={type.small}>
        {jump > 0 ? `Smallest jump: ${trim(jump)} ${unit}` : 'No plates selected: you can only lift the bar'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    minWidth: 56,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 20,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '300' },
  chipTextOn: { color: '#000' },
});
