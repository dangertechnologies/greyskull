import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Background } from '../components/Background';
import { Button } from '../components/Button';
import { PlatesLine } from '../components/PlatesLine';
import { Stepper } from '../components/Stepper';
import { WeightModal } from '../components/WeightModal';
import { formatWeight, toUnit, trim } from '../domain';
import { intensityLabel, nameOf } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { colors, type } from '../theme';

const CIRCLE = 44;

interface Props {
  session: SessionApi;
  onBack(): void;
  onFinish(): void;
}

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** StrongLifts-style checklist: every exercise and set on one scrollable page. */
export function SessionMinimal({ session, onBack, onFinish }: Props) {
  const { draft, items, record, setWeight, restRemaining, skipRest, isComplete } = session;
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const logSet = useStore((s) => s.logSet);
  const [weightFor, setWeightFor] = useState<string | null>(null);
  const [repsFor, setRepsFor] = useState<{ exerciseId: string; setIndex: number; reps: number } | null>(null);

  const circle = (item: SessionItem, index: number) => {
    const { exerciseId, setIndex } = item;
    if (setIndex === null) return null;
    const label = `Set ${item.position} of ${item.total}, ${item.logged ? `${item.reps} reps done` : `target ${item.targetReps ?? 'as many as possible'}`}`;
    const press = () => {
      if (!item.logged) record(index, item.targetReps ?? 5);
      else logSet(exerciseId, setIndex, item.reps - 1); // 0 turns the circle back to empty
    };
    return (
      <Pressable
        key={setIndex}
        accessibilityRole="button"
        accessibilityLabel={label}
        delayLongPress={400}
        onPress={press}
        onLongPress={() =>
          setRepsFor({ exerciseId, setIndex, reps: item.logged ? item.reps : (item.targetReps ?? 5) })
        }
        style={[styles.circle, item.logged && styles.circleOn]}
      >
        <Text style={[styles.circleText, item.logged && { color: '#000' }]}>
          {item.logged ? item.reps : item.targetReps === null ? '5+' : (item.targetReps ?? 5)}
        </Text>
      </Pressable>
    );
  };

  const weightExercise = weightFor ? exercises[weightFor] : undefined;

  return (
    <Background topInset>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={12}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={30} color={colors.text} />
        </Pressable>
        <Text style={type.heading} accessibilityRole="header">
          {intensityLabel(draft.dayName, draft.intensity ?? 1) ?? draft.dayName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {draft.order.map((id) => {
          const exercise = exercises[id];
          const result = draft.results[id];
          if (!exercise || !result) return null;
          const bodyweight = exercise.kind === 'bodyweight';
          const own = items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.exerciseId === id);
          const warm = own
            .filter(({ item }) => item.kind === 'warmup')
            .map(({ item }) =>
              item.targetReps !== null ? `${trim(toUnit(item.weightKg, unit))} ×${item.targetReps}` : '',
            );
          return (
            <View key={id} style={styles.exercise}>
              <View style={styles.titleRow}>
                <Text style={[type.heading, { flex: 1 }]}>{nameOf(exercises, id)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change weight, now ${bodyweight ? 'bodyweight' : formatWeight(result.weightKg, unit)}`}
                  disabled={bodyweight}
                  onPress={() => setWeightFor(id)}
                  style={styles.weight}
                >
                  <Text style={type.heading}>
                    {bodyweight ? 'Bodyweight' : formatWeight(result.weightKg, unit)}
                  </Text>
                  {bodyweight ? null : <PlatesLine kg={result.weightKg} />}
                </Pressable>
              </View>
              {warm.length > 0 ? <Text style={type.small}>{`Warm-up: ${warm.join(' · ')}`}</Text> : null}
              <View style={styles.circles}>
                {own
                  .filter(({ item }) => item.kind !== 'warmup')
                  .map(({ item, index }) => circle(item, index))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bar}>
        {restRemaining !== null ? (
          <>
            <Text style={type.body} accessibilityLiveRegion="polite">{`Rest ${clock(restRemaining)}`}</Text>
            <Button title="Skip" variant="link" onPress={skipRest} />
          </>
        ) : null}
        {isComplete ? <Button title="Finish workout" onPress={onFinish} /> : null}
      </View>

      {weightExercise && weightFor ? (
        <WeightModal
          visible
          exercise={weightExercise}
          kg={draft.results[weightFor].weightKg}
          onChange={(kg) => setWeight(weightFor, kg)}
          onClose={() => setWeightFor(null)}
        />
      ) : null}

      <Modal
        visible={repsFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRepsFor(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Stepper
              label="Reps"
              large
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
          </View>
        </View>
      </Modal>
    </Background>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 52 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 24, paddingBottom: 32 },
  exercise: { gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  weight: { alignItems: 'flex-end', minHeight: 44, justifyContent: 'center' },
  circles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOn: { backgroundColor: colors.text },
  circleText: { color: colors.text, fontSize: 16, fontWeight: '300' },
  bar: {
    padding: 12,
    gap: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.faint,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.faint,
  },
});
