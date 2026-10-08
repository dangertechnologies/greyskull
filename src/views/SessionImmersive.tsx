import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PhotoHeader } from '../components/PhotoHeader';
import { RestPanel } from '../components/RestPanel';
import { SetRail } from '../components/SetRail';
import { TechniqueLinks } from '../components/TechniqueLinks';
import { WeightSheet } from '../components/WeightSheet';
import { useTheme } from '../design/theme';
import { formatWeight, lastResult } from '../domain';
import { intensityLabel, nameOf } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { BottomBar, useGutter } from '../ui/layout';
import { NumberStepper } from '../ui/NumberStepper';
import { PlateStack } from '../ui/PlateStack';
import { Section } from '../ui/Section';
import { Text } from '../ui/Text';

const DEFAULT_AMRAP = 5;

interface Props {
  session: SessionApi;
  onBack(): void;
  onFinish(): void;
}

export function supertitle(item: SessionItem): string {
  if (item.kind === 'warmup') return `Warm-up ${item.position} of ${item.total}`;
  if (item.kind === 'amrap') {
    return item.total > 1 && item.targetReps !== null ? `Set ${item.position} of ${item.total}` : 'AMRAP';
  }
  return `Set ${item.position} of ${item.total}`;
}

/** One exercise per screen: photo header, the weight, the reps, the sets so far, then the Done button. */
export function SessionImmersive({ session, onBack, onFinish }: Props) {
  const {
    items,
    selectedIndex,
    select,
    record,
    setWeight,
    restRemaining,
    restTotal,
    skipRest,
    addRest,
    isComplete,
    draft,
  } = session;
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const unit = useStore((s) => s.unit);
  const t = useTheme();
  const gutter = useGutter();
  const [editingWeight, setEditingWeight] = useState(false);

  const item = items[selectedIndex];
  const exercise = item ? exercises[item.exerciseId] : undefined;
  const bodyweight = exercise?.kind === 'bodyweight';
  const last = useMemo(
    () => (item ? lastResult(sessions, item.exerciseId, draft.n) : null),
    [sessions, item, draft.n],
  );

  const fallbackReps = item?.logged
    ? item.reps
    : item?.kind === 'amrap'
      ? Math.max(1, last?.reps.at(-1) ?? DEFAULT_AMRAP)
      : (item?.targetReps ?? DEFAULT_AMRAP);
  const [reps, setReps] = useState(fallbackReps);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the reps control whenever another set is shown
  useEffect(() => setReps(fallbackReps), [selectedIndex, fallbackReps]);

  const ownIndices = item
    ? items.flatMap((i, index) => (i.exerciseId === item.exerciseId ? [index] : []))
    : [];
  // Counts this lift's pills, warm-ups included, so the label matches the row under it.
  const doneSets = ownIndices.filter((i) => items[i].logged).length;
  const light = intensityLabel(draft.dayName, draft.intensity ?? 1);
  const next = items.find((i, index) => index > selectedIndex && !i.logged);
  const nextText =
    next && exercises[next.exerciseId]
      ? `${nameOf(exercises, next.exerciseId, true)} · ${supertitle(next)} · ${
          exercises[next.exerciseId].kind === 'bodyweight' ? 'bodyweight' : formatWeight(next.weightKg, unit)
        } × ${next.targetReps ?? 'max'}`
      : undefined;

  const resting = restRemaining !== null;
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 280 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <PhotoHeader image={exercise?.background}>
          <IconButton icon="back" label="Back to Today" tone="onPhoto" onPress={onBack} />
          <View style={{ flex: 1 }} />
          {item && exercise ? (
            <View style={{ gap: t.space[2] }}>
              <Text variant="label" color="onPhotoMuted">
                {[light, supertitle(item)].filter(Boolean).join(' · ')}
              </Text>
              <Text variant="title" color="onPhoto" accessibilityRole="header">
                {nameOf(exercises, item.exerciseId)}
              </Text>
            </View>
          ) : (
            <Text variant="title" color="onPhoto">
              All sets done
            </Text>
          )}
        </PhotoHeader>

        <View style={{ paddingHorizontal: gutter, paddingTop: t.space[8], gap: t.space[10] }}>
          {item && exercise ? (
            <>
              <View style={{ gap: t.space[4] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change weight, now ${bodyweight ? 'bodyweight' : formatWeight(item.weightKg, unit)}`}
                  accessibilityState={{ disabled: bodyweight || item.kind === 'warmup' }}
                  disabled={bodyweight || item.kind === 'warmup'}
                  onPress={() => setEditingWeight(true)}
                  style={{ gap: t.space[3] }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                    <Text variant="display">
                      {bodyweight ? 'Bodyweight' : formatWeight(item.weightKg, unit)}
                    </Text>
                    {bodyweight || item.kind === 'warmup' ? null : (
                      <Icon name="edit" size={20} color="textMuted" />
                    )}
                  </View>
                  {bodyweight || exercise.kind !== 'barbell' ? null : <PlateStack kg={item.weightKg} />}
                </Pressable>
                {last && !bodyweight ? (
                  <Text variant="callout" color="textMuted">
                    {`Last time: ${formatWeight(last.weightKg, unit)} × ${last.reps.at(-1) ?? 0}`}
                  </Text>
                ) : null}
              </View>

              <View style={{ alignItems: 'center' }}>
                {item.kind === 'warmup' ? (
                  <View style={{ alignItems: 'center', gap: t.space[1] }}>
                    <Text variant="display">{item.targetReps}</Text>
                    <Text variant="label" color="textMuted">
                      reps
                    </Text>
                  </View>
                ) : (
                  <NumberStepper
                    label={item.kind === 'amrap' ? 'Reps (as many as possible)' : 'Reps'}
                    size="lg"
                    value={reps}
                    min={1}
                    step={1}
                    format={String}
                    onChange={setReps}
                  />
                )}
              </View>

              <Section label={`${doneSets} of ${ownIndices.length} sets done`}>
                <SetRail items={items} indices={ownIndices} selectedIndex={selectedIndex} onSelect={select} />
              </Section>

              <Section label="Technique">
                <View style={{ gap: t.space[4] }}>
                  {(exercise.goodForm ?? []).map((tip) => (
                    <View
                      key={`do-${tip}`}
                      style={{ flexDirection: 'row', gap: t.space[3], alignItems: 'flex-start' }}
                    >
                      <Icon name="do" size={22} color="success" />
                      <Text variant="callout" style={{ flex: 1 }}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                  {(exercise.badForm ?? []).map((tip) => (
                    <View
                      key={`dont-${tip}`}
                      style={{ flexDirection: 'row', gap: t.space[3], alignItems: 'flex-start' }}
                    >
                      <Icon name="dont" size={22} color="danger" />
                      <Text variant="callout" style={{ flex: 1 }}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
                <TechniqueLinks exercise={exercise} />
              </Section>
            </>
          ) : null}
        </View>
      </ScrollView>

      <BottomBar>
        {resting ? (
          <RestPanel
            remaining={restRemaining}
            total={restTotal}
            next={nextText}
            onAdd={addRest}
            onSkip={skipRest}
          />
        ) : isComplete && selectedIndex >= items.length ? (
          <Button title="Finish workout" size="lg" testID="finish-workout" onPress={onFinish} />
        ) : item ? (
          <>
            <Button
              title={item.logged && item.kind !== 'warmup' ? 'Update set' : 'Done'}
              size="lg"
              testID="done-set"
              onPress={() => record(selectedIndex, item.kind === 'warmup' ? (item.targetReps ?? 0) : reps)}
            />
            {isComplete ? (
              <Button title="Finish workout" variant="secondary" testID="finish-workout" onPress={onFinish} />
            ) : null}
          </>
        ) : null}
      </BottomBar>

      {editingWeight && exercise && item ? (
        <WeightSheet
          visible
          exercise={exercise}
          kg={item.weightKg}
          onChange={(kg) => setWeight(item.exerciseId, kg)}
          onClose={() => setEditingWeight(false)}
        />
      ) : null}
    </View>
  );
}
