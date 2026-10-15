import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise, PlateInventory, SetResult, Unit } from '../domain';
import { formatWeight } from '../domain';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { PlateStack } from '../ui/PlateStack';
import { Text } from '../ui/Text';

/** Exercise name, weight and scheme on one row; barbell lifts show the plates for one side underneath. */
export function LiftRow({
  exercise,
  kg,
  schemeLabel,
  sets,
  unit,
  inventory,
}: {
  exercise: Exercise;
  kg: number;
  schemeLabel: string;
  sets?: SetResult[];
  unit?: Unit;
  inventory?: PlateInventory;
}) {
  const t = useTheme();
  const bodyweight = exercise.kind === 'bodyweight';
  const perSet = sets?.some((s) => s.kg !== undefined);
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
        {perSet ? (
          sets?.map((set, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: sets retain their prescribed order
            <View key={i} style={{ alignItems: 'flex-end' }}>
              <Text variant="callout">{`${unit ? formatWeight(set.kg ?? kg, unit) : (set.kg ?? kg)} × ${set.target ?? 'AMRAP'}`}</Text>
              {exercise.kind === 'barbell' ? (
                <PlateStack kg={set.kg ?? kg} size="sm" unit={unit} inventory={inventory} />
              ) : null}
            </View>
          ))
        ) : (
          <Text variant="headline">
            {bodyweight ? 'Bodyweight' : unit ? formatWeight(kg, unit) : `${kg}`}
          </Text>
        )}
        {bodyweight || perSet || exercise.kind !== 'barbell' ? null : (
          <PlateStack kg={kg} size="sm" unit={unit} inventory={inventory} />
        )}
      </View>
    </View>
  );
}
