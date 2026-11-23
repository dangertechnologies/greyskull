import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RestPanel } from '../components/RestPanel';
import { TechniqueLinks } from '../components/TechniqueLinks';
import { WeightSheet } from '../components/WeightSheet';
import { haptics } from '../design/haptics';
import { useTheme } from '../design/theme';
import { formatWeight } from '../domain';
import { intensityLabel, nameOf, weightLabel } from '../format';
import type { SessionApi, SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { IconButton } from '../ui/IconButton';
import { BottomBar, useGutter } from '../ui/layout';
import { NumberStepper } from '../ui/NumberStepper';
import { PlateStack } from '../ui/PlateStack';
import { Sheet } from '../ui/Sheet';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { EaseBanner } from './EaseBanner';
import { clockLabel, HoldDial } from './HoldDial';
import { LadderPanel } from './LadderPanel';
import { supertitle } from './SessionImmersive';
import { useStopwatch } from './useStopwatch';

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
  const [repsFor, setRepsFor] = useState<{
    exerciseId: string;
    setIndex: number;
    reps: number;
    timed?: boolean;
  } | null>(null);
  // The timed set the stopwatch belongs to (its index in `items` and target seconds), and whether its sheet is
  // open. Closing the sheet keeps the stopwatch running; the bottom bar then offers to reopen it.
  const [holdFor, setHoldFor] = useState<{ index: number; target: number | null } | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const watch = useStopwatch(holdFor?.target ?? null);
  const openHold = (index: number, target: number | null) => {
    if (holdFor?.index !== index) watch.reset();
    setHoldFor({ index, target });
    setHoldOpen(true);
  };
  const finishHold = () => {
    watch.reset();
    setHoldOpen(false);
    setHoldFor(null);
  };
  const holdItem = holdFor ? items[holdFor.index] : undefined;
  const anyTimed = items.some((i) => i.timed);

  const pill = (item: SessionItem, index: number) => {
    const { exerciseId, setIndex } = item;
    if (setIndex === null) return null;
    const s = item.timed ? ' s' : '';
    const label = `Set ${item.position} of ${item.total}, ${item.logged ? `${item.reps} ${item.timed ? 'seconds' : 'reps'} done` : `target ${item.targetReps === null ? 'as many as possible' : `${item.targetReps}${item.timed ? ' seconds' : ''}`}`}`;
    const edit = () =>
      setRepsFor({
        exerciseId,
        setIndex,
        reps: item.logged ? item.reps : (item.targetReps ?? item.minReps ?? 5),
        timed: item.timed,
      });
    return (
      <Pressable
        key={setIndex}
        testID={`set-pill-${exerciseId}-${item.position}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}${item.perSetWeight ? `, ${formatWeight(item.weightKg, unit)}` : ''}`}
        accessibilityActions={[{ name: 'edit', label: item.timed ? 'Edit seconds' : 'Edit reps' }]}
        accessibilityHint={item.timed ? 'Opens the hold stopwatch' : undefined}
        onAccessibilityAction={edit}
        delayLongPress={400}
        onPress={() => {
          // A hold is timed with the stopwatch; a logged one can be held again.
          if (item.timed) openHold(index, item.targetReps);
          else if (!item.logged) record(index, item.targetReps ?? item.minReps ?? 5);
          else {
            haptics.tick();
            logSet(exerciseId, setIndex, item.reps - 1); // 0 turns the pill back to empty
          }
        }}
        onLongPress={edit}
        style={{
          minWidth: 56,
          minHeight: 56,
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
          {item.logged
            ? `${item.reps}${s}`
            : item.targetReps === null
              ? `${item.minReps ?? 5}+`
              : `${item.targetReps ?? item.minReps ?? 5}${s}`}
        </Text>
        {item.perSetWeight ? (
          <>
            <Text variant="caption" color={item.logged ? 'background' : 'textMuted'}>
              {formatWeight(item.weightKg, unit)}
            </Text>
            {exercises[exerciseId]?.kind === 'barbell' ? (
              <PlateStack kg={item.weightKg} size="sm" exercise={exercises[exerciseId]} />
            ) : null}
          </>
        ) : null}
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
        <EaseBanner draft={draft} />
        {draft.order.map((id) => {
          const exercise = exercises[id];
          const result = draft.results[id];
          if (!exercise || !result) return null;
          const perSetWeight = result.sets.some((s) => s.kg !== undefined);
          const bodyweight = exercise.kind === 'bodyweight';
          const weightText = weightLabel(result.weightKg, exercise, unit).trim() || 'Bodyweight';
          // Added load is for reps on a bodyweight exercise, not for holds or band-assisted steps.
          const canEdit = !perSetWeight && !(bodyweight && (result.timed || result.band));
          const own = items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.exerciseId === id);
          const warm = own.filter(({ item }) => item.kind === 'warmup');
          return (
            <Card key={id} style={{ gap: t.space[5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
                <ExerciseBadge exercise={exercise} size={40} />
                <Text variant="headline" style={{ flex: 1 }}>
                  {nameOf(exercises, id)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${bodyweight ? 'added load' : 'weight'}, now ${weightText}`}
                  accessibilityState={{ disabled: !canEdit }}
                  disabled={!canEdit}
                  onPress={() => setWeightFor(id)}
                  style={{ minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', gap: t.space[1] }}
                >
                  <Text variant="headline">{weightText}</Text>
                </Pressable>
              </View>
              <LadderPanel draft={draft} exerciseId={id} compact />
              {bodyweight || perSetWeight || exercise.kind !== 'barbell' ? null : (
                <PlateStack kg={result.weightKg} size="sm" exercise={exercise} />
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
        {holdFor && !holdOpen && (watch.running || watch.seconds > 0) ? (
          <Button
            title={`Hold ${clockLabel(watch.seconds)} · open`}
            size="lg"
            icon="timer"
            testID="reopen-hold"
            onPress={() => setHoldOpen(true)}
          />
        ) : restRemaining !== null ? (
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
            {anyTimed
              ? 'Tap a set when you finish it, or a hold to time it. Press and hold to change it.'
              : 'Tap a set when you finish it. Hold to change the reps.'}
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

      <Sheet visible={holdOpen && holdFor !== null} onClose={() => setHoldOpen(false)} title="Hold">
        <HoldDial watch={watch} targetS={holdFor?.target ?? null} />
        <Button
          title={`Log ${watch.seconds} s`}
          testID="log-hold"
          disabled={watch.seconds === 0}
          onPress={() => {
            if (holdFor) record(holdFor.index, watch.seconds);
            finishHold();
          }}
        />
        {holdItem?.logged && holdItem.setIndex !== null ? (
          <Button
            title={`Clear the logged ${holdItem.reps} s`}
            variant="plain"
            testID="clear-hold"
            onPress={() => {
              if (holdItem.setIndex !== null) logSet(holdItem.exerciseId, holdItem.setIndex, 0);
              finishHold();
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={repsFor !== null}
        onClose={() => setRepsFor(null)}
        title={repsFor?.timed ? 'Seconds' : 'Reps'}
      >
        <NumberStepper
          label={repsFor?.timed ? 'Seconds held' : 'Reps'}
          size="lg"
          value={repsFor?.reps ?? 0}
          min={1}
          step={1}
          format={repsFor?.timed ? (v) => `${v} s` : String}
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
