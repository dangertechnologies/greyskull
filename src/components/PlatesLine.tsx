import { Text } from 'react-native';
import { formatPlates } from '../domain';
import { useStore } from '../store';
import { type } from '../theme';

/** "per side: 20 + 1.25" or "bar only" for a weight in kg, in the user's unit and plates. */
export function PlatesLine({ kg }: { kg: number }) {
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);
  return <Text style={type.small}>{formatPlates(kg, inventory, unit)}</Text>;
}
