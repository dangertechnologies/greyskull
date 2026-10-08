import { useState } from 'react';
import { View } from 'react-native';
import { WeightStepper } from '../../src/components/WeightStepper';
import { useTheme } from '../../src/design/theme';
import { exerciseIdsOf, roundForExercise } from '../../src/domain';
import { goHome } from '../../src/navigation';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ExerciseBadge } from '../../src/ui/ExerciseBadge';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { PlateStack } from '../../src/ui/PlateStack';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

export default function ConfirmWeights() {
  const exercises = useStore((s) => s.exercises);
  const program = useStore((s) => s.program);
  const suspects = useStore((s) => s.needsWeightConfirmSuspects);
  const storedLifts = useStore((s) => s.lifts);
  const confirmWeights = useStore((s) => s.confirmWeights);
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);
  const t = useTheme();

  const ids = (program ? exerciseIdsOf(program) : []).filter(
    (id) => storedLifts[id] && exercises[id]?.kind !== 'bodyweight',
  );
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        roundForExercise(storedLifts[id].weightKg, exercises[id], 'nearest', inventory, unit),
      ]),
    ),
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScreenScroll withBottomBar headerless gap={6}>
        <Text variant="title" accessibilityRole="header">
          Check your weights
        </Text>
        <Text color="textMuted">We moved your data from the old version. Please check these weights.</Text>
        <View style={{ height: t.space[4] }} />
        <View style={{ gap: t.space[6] }}>
          {ids.map((id) => (
            <Card key={id} style={{ gap: t.space[5], alignItems: 'center' }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3], alignSelf: 'stretch' }}
              >
                <ExerciseBadge exercise={exercises[id]} size={40} />
                <Text variant="headline" style={{ flex: 1 }}>
                  {exercises[id].name}
                </Text>
                {suspects.includes(id) ? (
                  <Text variant="label" color="danger">
                    looks wrong
                  </Text>
                ) : null}
              </View>
              <WeightStepper
                exercise={exercises[id]}
                kg={weights[id]}
                onChange={(kg) => setWeights((w) => ({ ...w, [id]: kg }))}
              />
              {exercises[id].kind === 'barbell' ? <PlateStack kg={weights[id]} /> : null}
            </Card>
          ))}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          title="Confirm"
          size="lg"
          testID="confirm-weights"
          onPress={() => {
            confirmWeights(weights);
            goHome();
          }}
        />
      </BottomBar>
    </View>
  );
}
