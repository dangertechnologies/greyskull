import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Background } from '../components/Background';
import { Button } from '../components/Button';
import { PlatesLine } from '../components/PlatesLine';
import { RestRing } from '../components/RestRing';
import { Stepper } from '../components/Stepper';
import { TechniqueLinks } from '../components/TechniqueLinks';
import { WeightModal } from '../components/WeightModal';
import { formatWeight } from '../domain';
import { intensityLabel, nameOf } from '../format';
import type { SessionApi } from '../hooks/useSession';
import { useStore } from '../store';
import { colors, type } from '../theme';

const DEFAULT_AMRAP = 5;

interface Props {
  session: SessionApi;
  onBack(): void;
  onFinish(): void;
}

function supertitle(item: SessionApi['items'][number]): string {
  if (item.kind === 'warmup') return `Warm-up ${item.position} of ${item.total}`;
  if (item.kind === 'amrap')
    return item.total > 1 && item.targetReps !== null ? `Set ${item.position} of ${item.total}` : 'AMRAP';
  return `Set ${item.position} of ${item.total}`;
}

/** One exercise per screen on a full-bleed photo: the v1 look. */
export function SessionImmersive({ session, onBack, onFinish }: Props) {
  const { items, activeIndex, record, setWeight, restRemaining, skipRest, isComplete } = session;
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const restSeconds = useStore((s) => s.restSeconds);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [amrapReps, setAmrapReps] = useState(DEFAULT_AMRAP);

  const item = items[activeIndex];
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the AMRAP stepper whenever the active set changes
  useEffect(() => setAmrapReps(DEFAULT_AMRAP), [activeIndex]);

  const exercise = item ? exercises[item.exerciseId] : undefined;
  const bodyweight = exercise?.kind === 'bodyweight';
  const sets = items.filter((i) => i.kind !== 'warmup');
  const doneSets = sets.filter((i) => i.logged).length;

  return (
    <Background image={exercise?.background} topInset>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        hitSlop={12}
        onPress={onBack}
        style={[styles.back, { top: insets.top + 8 }]}
      >
        <Ionicons name="chevron-back" size={30} color={colors.text} />
      </Pressable>

      {item && exercise ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={type.label}>
            {[intensityLabel(session.draft.dayName, session.draft.intensity ?? 1), supertitle(item)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={type.title} accessibilityRole="header">
            {nameOf(exercises, item.exerciseId)}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change weight, now ${bodyweight ? 'bodyweight' : formatWeight(item.weightKg, unit)}`}
            disabled={bodyweight || item.kind === 'warmup'}
            onPress={() => setEditing(true)}
            style={styles.weight}
          >
            <Text style={styles.bigWeight}>
              {bodyweight ? 'Bodyweight' : formatWeight(item.weightKg, unit)}
            </Text>
            {bodyweight ? null : <PlatesLine kg={item.weightKg} />}
          </Pressable>

          <View style={styles.reps}>
            {item.kind === 'amrap' ? (
              <Stepper
                label="Reps (as many as possible)"
                large
                value={amrapReps}
                min={1}
                step={1}
                format={String}
                onChange={setAmrapReps}
              />
            ) : (
              <>
                <Text style={styles.bigReps}>{item.targetReps}</Text>
                <Text style={type.label}>reps</Text>
              </>
            )}
          </View>

          <Button
            title="Done"
            onPress={() => record(activeIndex, item.kind === 'amrap' ? amrapReps : (item.targetReps ?? 0))}
          />

          <View style={styles.form}>
            {(exercise.goodForm ?? []).map((t) => (
              <View key={`do-${t}`} style={styles.tip}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.good}
                  accessibilityLabel="Do"
                />
                <Text style={[type.body, styles.tipText]}>{t}</Text>
              </View>
            ))}
            {(exercise.badForm ?? []).map((t) => (
              <View key={`dont-${t}`} style={styles.tip}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={colors.danger}
                  accessibilityLabel="Don't"
                />
                <Text style={[type.body, styles.tipText]}>{t}</Text>
              </View>
            ))}
          </View>
          <TechniqueLinks exercise={exercise} />
          <Text style={[type.small, styles.progress]}>{`${doneSets} of ${sets.length} sets done`}</Text>
        </ScrollView>
      ) : (
        <View style={styles.content}>
          <Text style={type.title}>All sets done</Text>
          {isComplete ? <Button title="Finish workout" onPress={onFinish} /> : null}
        </View>
      )}

      {editing && exercise && item ? (
        <WeightModal
          visible
          exercise={exercise}
          kg={item.weightKg}
          onChange={(kg) => setWeight(item.exerciseId, kg)}
          onClose={() => setEditing(false)}
        />
      ) : null}

      {restRemaining !== null ? (
        <RestRing
          remaining={restRemaining}
          total={restSeconds}
          onSkip={skipRest}
          next={
            item && exercise
              ? `${nameOf(exercises, item.exerciseId, true)} · ${supertitle(item)} · ${
                  exercise.kind === 'bodyweight' ? 'bodyweight' : formatWeight(item.weightKg, unit)
                } × ${item.targetReps ?? 'max'}`
              : undefined
          }
        />
      ) : null}
    </Background>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: 8,
    zIndex: 5,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 24, paddingTop: 72, gap: 16, flexGrow: 1 },
  weight: { gap: 4, paddingVertical: 8 },
  bigWeight: { color: colors.text, fontSize: 56, fontWeight: '200' },
  reps: { alignItems: 'flex-start', paddingVertical: 8 },
  bigReps: { color: colors.text, fontSize: 96, fontWeight: '200', lineHeight: 104 },
  form: { gap: 10, paddingTop: 8 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 21 },
  progress: { textAlign: 'center' },
});
