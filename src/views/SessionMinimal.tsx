import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RestPanel } from '../components/RestPanel';
import { TechniqueLinks } from '../components/TechniqueLinks';
import { WeightSheet } from '../components/WeightSheet';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { formatWeight } from '../domain';
import { intensityLabel, nameOf } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { BottomBar, useGutter } from '../ui/layout';
import { Monogram } from '../ui/Monogram';
import { NumberStepper } from '../ui/NumberStepper';
import { PlateStack } from '../ui/PlateStack';
import { Sheet } from '../ui/Sheet';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { supertitle } from './SessionImmersive';

interface Props {
  session: SessionApi;
  onBack(): void;
  onFinish(): void;
}

/** StrongLifts-style checklist: every exercise and its sets on one scrollable page. */
export function SessionMinimal({ session, onBack, onFinish }: Props) {
  const { draft, items, record, setWeight, restRemaining, restTotal, skipRest, addRest, isComplete } =
    session;
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const logSet = useStore((s) => s.logSet);
  const t = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const [weightFor, setWeightFor] = useState<string | null>(null);
  const [repsFor, setRepsFor] = useState<{ exerciseId: string; setIndex: number; reps: number } | null>(null);

  const pill = (item: SessionItem, index: number) => {
    const { exerciseId, setIndex } = item;
    if (setIndex === null) return null;
    const label = `Set ${item.position} of ${item.total}, ${item.logged ? `${item.reps} reps done` : `target ${item.targetReps ?? 'as many as possible'}`}`;
    return (
      <Pressable
        key={setIndex}
        testID={`set-pill-${exerciseId}-${item.position}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'edit', label: 'Edit reps' }]}
        onAccessibilityAction={() =>
          setRepsFor({ exerciseId, setIndex, reps: item.logged ? item.reps : (item.targetReps ?? 5) })
        }
        delayLongPress={400}
        onPress={() => {
          if (!item.logged) record(index, item.targetReps ?? 5);
          else {
            haptics.tick();
            logSet(exerciseId, setIndex, item.reps - 1); // 0 turns the pill back to empty
          }
        }}
        onLongPress={() =>
          setRepsFor({ exerciseId, setIndex, reps: item.logged ? item.reps : (item.targetReps ?? 5) })
        }
        style={{
          minWidth: 56,
          height: 56,
          paddingHorizontal: t.space[3],
          borderRadius: t.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: item.logged ? t.color.success : 'transparent',
          borderWidth: item.logged ? 0 : 1,
          borderColor: t.color.borderStrong,
        }}
      >
        <Text variant="bodyStrong" color={item.logged ? 'background' : 'text'}>
          {item.logged ? item.reps : item.targetReps === null ? '5+' : (item.targetReps ?? 5)}
        </Text>
      </Pressable>
    );
  };

  // Warm-ups are tappable too, so you can tick them off here as in the one-lift view (they start no rest).
  const warmupPill = (item: SessionItem, index: number) => {
    const text = `${formatWeight(item.weightKg, unit)} ×${item.targetReps ?? 0}`;
    return (
      <Pressable
        key={`warmup-${item.position}`}
        accessibilityRole="button"
        accessibilityLabel={`Warm-up ${item.position} of ${item.total}, ${text}${item.logged ? ', done' : ''}`}
        accessibilityState={{ disabled: item.logged }}
        disabled={item.logged}
        onPress={() => {
          haptics.tick();
          record(index, item.targetReps ?? 0);
        }}
        style={{
          minHeight: 44,
          paddingHorizontal: t.space[3],
          borderRadius: t.radius.pill,
          justifyContent: 'center',
          backgroundColor: item.logged ? t.color.surfaceRaised : 'transparent',
          borderWidth: item.logged ? 0 : 1,
          borderStyle: 'dashed',
          borderColor: t.color.borderStrong,
        }}
      >
        <Text variant="callout" color={item.logged ? 'textMuted' : 'text'}>
          {text}
        </Text>
      </Pressable>
    );
  };

  const weightExercise = weightFor ? exercises[weightFor] : undefined;
  const next = items.find((i) => !i.logged);
  const nextText =
    next && exercises[next.exerciseId]
      ? `${nameOf(exercises, next.exerciseId, true)} · ${supertitle(next)}`
      : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <View
        style={{
          paddingTop: insets.top + t.space[2],
          paddingHorizontal: t.space[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space[2],
        }}
      >
        <IconButton icon="back" label="Back to Today" onPress={onBack} />
        <Text variant="headline" accessibilityRole="header">
          {intensityLabel(draft.dayName, draft.intensity ?? 1) ?? draft.dayName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: t.space[6],
          paddingBottom: 320,
          gap: t.space[6],
        }}
      >
        {draft.order.map((id) => {
          const exercise = exercises[id];
          const result = draft.results[id];
          if (!exercise || !result) return null;
          const bodyweight = exercise.kind === 'bodyweight';
          const own = items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.exerciseId === id);
          const warm = own.filter(({ item }) => item.kind === 'warmup');
          return (
            <Card key={id} style={{ gap: t.space[5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
                <Monogram exercise={exercise} size={40} />
                <Text variant="headline" style={{ flex: 1 }}>
                  {nameOf(exercises, id)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change weight, now ${bodyweight ? 'bodyweight' : formatWeight(result.weightKg, unit)}`}
                  disabled={bodyweight}
                  onPress={() => setWeightFor(id)}
                  style={{ minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', gap: t.space[1] }}
                >
                  <Text variant="headline">
                    {bodyweight ? 'Bodyweight' : formatWeight(result.weightKg, unit)}
                  </Text>
                </Pressable>
              </View>
              {bodyweight || exercise.kind !== 'barbell' ? null : (
                <PlateStack kg={result.weightKg} size="sm" />
              )}
              {warm.length > 0 ? (
                <View style={{ gap: t.space[2] }}>
                  <Text variant="label" color="textMuted">
                    Warm-up
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
                    {warm.map(({ item, index }) => warmupPill(item, index))}
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
                {own.filter(({ item }) => item.kind !== 'warmup').map(({ item, index }) => pill(item, index))}
              </View>
              <TechniqueLinks exercise={exercise} compact />
            </Card>
          );
        })}
      </ScrollView>

      <BottomBar>
        {restRemaining !== null ? (
          <RestPanel
            remaining={restRemaining}
            total={restTotal}
            next={nextText}
            onAdd={addRest}
            onSkip={skipRest}
          />
        ) : isComplete ? (
          <Button title="Finish workout" size="lg" testID="finish-workout" onPress={onFinish} />
        ) : (
          <Text variant="callout" color="textMuted" align="center">
            Tap a set when you finish it. Hold to change the reps.
          </Text>
        )}
      </BottomBar>

      {weightExercise && weightFor ? (
        <WeightSheet
          visible
          exercise={weightExercise}
          kg={draft.results[weightFor].weightKg}
          onChange={(kg) => setWeight(weightFor, kg)}
          onClose={() => setWeightFor(null)}
        />
      ) : null}

      <Sheet visible={repsFor !== null} onClose={() => setRepsFor(null)} title="Reps">
        <NumberStepper
          label="Reps"
          size="lg"
          value={repsFor?.reps ?? 0}
          min={1}
          step={1}
          format={String}
          onChange={(reps) => setRepsFor((r) => (r ? { ...r, reps } : r))}
        />
        <Button
          title="Done"
          onPress={() => {
            if (repsFor) logSet(repsFor.exerciseId, repsFor.setIndex, repsFor.reps);
            setRepsFor(null);
          }}
        />
      </Sheet>
    </View>
  );
}
