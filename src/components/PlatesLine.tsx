import { Text } from 'react-native';
import type { PlateInventory, Unit } from '../domain';
import { formatPlates } from '../domain';
import { useInventory, useUnit } from '../store';
import { type } from '../theme';

/** "per side: 20 + 1.25" or "bar only" for a weight in kg, in the user's unit and plates. */
export function PlatesLine({
  kg,
  unit: unitProp,
  inventory: inventoryProp,
}: {
  kg: number;
  unit?: Unit;
  inventory?: PlateInventory;
}) {
  const storeUnit = useUnit();
  const storeInventory = useInventory();
  const unit = unitProp ?? storeUnit;
  const inventory = inventoryProp ?? storeInventory;
  return <Text style={type.small}>{formatPlates(kg, inventory, unit)}</Text>;
}
