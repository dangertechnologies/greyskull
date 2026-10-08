import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise, PlateInventory, Unit } from '../domain';
import { formatWeight } from '../domain';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { PlateStack } from '../ui/PlateStack';
import { Text } from '../ui/Text';

/** Exercise name, weight and scheme on one row; barbell lifts show the plates for one side underneath. */
export function LiftRow({
  exercise,
  kg,
  schemeLabel,
  unit,
  inventory,
}: {
  exercise: Exercise;
  kg: number;
  schemeLabel: string;
  unit?: Unit;
  inventory?: PlateInventory;
}) {
  const t = useTheme();
  const bodyweight = exercise.kind === 'bodyweight';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
      <ExerciseBadge exercise={exercise} />
      <View style={{ flex: 1, gap: t.space[1] }}>
        <Text variant="bodyStrong">{exercise.name}</Text>
        <Text variant="caption" color="textMuted">
          {schemeLabel}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: t.space[1] }}>
        <Text variant="headline">{bodyweight ? 'Bodyweight' : unit ? formatWeight(kg, unit) : `${kg}`}</Text>
        {bodyweight || exercise.kind !== 'barbell' ? null : (
          <PlateStack kg={kg} size="sm" unit={unit} inventory={inventory} />
        )}
      </View>
    </View>
  );
}
