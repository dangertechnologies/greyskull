import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PhotoHeader } from '../components/PhotoHeader';
import { RestPanel } from '../components/RestPanel';
import { SetRail } from '../components/SetRail';
import { TechniqueLinks } from '../components/TechniqueLinks';
import { WeightSheet } from '../components/WeightSheet';
import { useTheme } from '../design/theme';
import { lastResult } from '../domain';
import { intensityLabel, nameOf, weightLabel } from '../format';
import { isTimerKind, type SessionApi, type SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { BottomBar, useGutter } from '../ui/layout';
import { NumberStepper } from '../ui/NumberStepper';
import { PlateStack } from '../ui/PlateStack';
import { Section } from '../ui/Section';
import { Text } from '../ui/Text';
import { EaseBanner } from './EaseBanner';
import { roundLabel, targetText } from './groupText';
import { clockLabel, HoldDial } from './HoldDial';
import { LadderPanel, ladderLine, ladderSlot } from './LadderPanel';
import { useStopwatch } from './useStopwatch';

const DEFAULT_AMRAP = 5;

interface Props {
  session: SessionApi;
  onBack(): void;
  onFinish(): void;
}

export function supertitle(item: SessionItem): string {
  if (item.kind === 'warmup') return `Warm-up ${item.position} of ${item.total}`;
  if (item.group) return roundLabel(item.group);
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
  const timed = item?.timed === true && item.kind !== 'warmup';
  const ladder = item ? ladderSlot(draft, item.exerciseId) : undefined;
  const band = item ? draft.results[item.exerciseId]?.band : undefined;
  // Added load is for reps on a bodyweight exercise, not for holds or band-assisted steps.
  const canEditWeight =
    !!item && item.kind !== 'warmup' && !item.perSetWeight && !(bodyweight && (timed || band));
  const weightText =
    item && exercise ? weightLabel(item.weightKg, exercise, unit).trim() || 'Bodyweight' : '';
  const watch = useStopwatch(timed ? (item?.targetReps ?? null) : null);
  const { reset: resetWatch } = watch;
  // A hold belongs to the set it was started on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever another set is shown
  useEffect(() => resetWatch(), [selectedIndex, resetWatch]);
  const last = useMemo(
    () => (item ? lastResult(sessions, item.exerciseId, draft.n) : null),
    [sessions, item, draft.n],
  );

  const fallbackReps = item?.logged
    ? item.reps
    : item?.kind === 'amrap'
      ? Math.max(1, last?.reps.at(-1) ?? item.minReps ?? DEFAULT_AMRAP)
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
          weightLabel(next.weightKg, exercises[next.exerciseId], unit).trim() || 'bodyweight'
        } × ${next.targetReps ?? 'max'}${next.timed ? ' s' : ''}`
      : undefined;
  // A paused hold fills in the seconds; the stepper can still correct them.
  const shownReps = timed && watch.seconds > 0 && !watch.running ? watch.seconds : reps;

  // A superset or circuit round: its exercises together, the shown one highlighted, rest only after the round.
  const roundOf = item?.group && !isTimerKind(item.group.kind) ? item.group : undefined;
  const round = roundOf
    ? items.flatMap((i, index) =>
        i.group?.id === roundOf.id && i.group.round === roundOf.round ? [{ i, index }] : [],
      )
    : [];
  const afterThis = roundOf
    ? roundOf.restAfterS
      ? `After this: rest ${roundOf.restAfterS} s${roundOf.round < roundOf.rounds ? `, then round ${roundOf.round + 1}` : ''}`
      : next?.group?.id === roundOf.id
        ? `No rest: ${next.group.label} ${nameOf(exercises, next.exerciseId, true)} next`
        : undefined
    : undefined;
  const doneTitle =
    item?.logged && item.kind !== 'warmup'
      ? 'Update set'
      : roundOf
        ? `Done ${roundOf.label}${roundOf.restAfterS ? ' · start rest' : ''}`
        : 'Done';

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
              {ladder ? (
                <Text variant="callout" color="onPhotoMuted">
                  {ladderLine(ladder.ladder, ladder.step)}
                </Text>
              ) : null}
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
              <EaseBanner draft={draft} />

              {ladder ? <LadderPanel draft={draft} exerciseId={item.exerciseId} /> : null}

              {roundOf ? (
                <View style={{ gap: t.space[3] }} testID="round-card">
                  {round.map(({ i, index }, k) => {
                    const current = index === selectedIndex;
                    return (
                      <View key={`${i.exerciseId}-${i.position}`} style={{ gap: t.space[3] }}>
                        {k > 0 ? (
                          <Text variant="caption" color="textMuted" align="center">
                            no rest here
                          </Text>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: current }}
                          accessibilityLabel={`${i.group?.label} ${nameOf(exercises, i.exerciseId)}, set ${i.position}, ${i.logged ? `${i.reps}${i.timed ? ' seconds' : ' reps'} done` : `target ${targetText(i)}`}`}
                          onPress={() => select(index)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: t.space[4],
                            minHeight: 64,
                            padding: t.space[4],
                            borderRadius: t.radius.xl,
                            backgroundColor: t.color.surface,
                            borderWidth: current ? 2 : 1,
                            borderColor: current ? t.color.accent : t.color.border,
                          }}
                        >
                          <View
                            style={{
                              minWidth: 44,
                              paddingHorizontal: t.space[2],
                              paddingVertical: t.space[1],
                              borderRadius: t.radius.pill,
                              alignItems: 'center',
                              backgroundColor: current ? t.color.chartFill : 'transparent',
                              borderWidth: current ? 0 : 1,
                              borderColor: t.color.border,
                            }}
                          >
                            <Text variant="bodyStrong" color={current ? 'accent' : 'textMuted'}>
                              {i.group?.label}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: t.space[1] }}>
                            <Text variant="bodyStrong">{nameOf(exercises, i.exerciseId)}</Text>
                            <Text variant="callout" color="textMuted">
                              {`Set ${i.position} · ${i.logged ? `${i.reps}${i.timed ? ' s' : ' reps'}` : `target ${targetText(i)}`}`}
                            </Text>
                          </View>
                          {i.logged ? <Icon name="check" size={22} color="success" /> : null}
                        </Pressable>
                      </View>
                    );
                  })}
                  {afterThis ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                      <Icon name="timer" size={20} color="accent" />
                      <Text variant="callout" style={{ flex: 1 }}>
                        {afterThis}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ gap: t.space[4] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${bodyweight ? 'added load' : 'weight'}, now ${weightText}`}
                  accessibilityState={{ disabled: !canEditWeight }}
                  disabled={!canEditWeight}
                  onPress={() => setEditingWeight(true)}
                  style={{ gap: t.space[3] }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                    <Text variant={timed && bodyweight ? 'headline' : 'display'}>{weightText}</Text>
                    {canEditWeight ? <Icon name="edit" size={20} color="textMuted" /> : null}
                  </View>
                  {bodyweight && item.weightKg > 0 ? (
                    <Text variant="callout" color="textMuted">
                      Added load
                    </Text>
                  ) : null}
                  {bodyweight || exercise.kind !== 'barbell' ? null : (
                    <PlateStack kg={item.weightKg} exercise={exercise} />
                  )}
                </Pressable>
                {last ? (
                  <Text variant="callout" color="textMuted">
                    {`Last time:${weightLabel(last.weightKg, exercise, unit) || ' bodyweight'} × ${last.reps.at(-1) ?? 0}${timed ? ' s' : ''}`}
                  </Text>
                ) : null}
              </View>

              {timed ? <HoldDial watch={watch} targetS={item.targetReps} /> : null}

              <View style={{ alignItems: 'flex-start' }}>
                {item.kind === 'warmup' ? (
                  <View style={{ alignItems: 'center', gap: t.space[1], minWidth: 112 }}>
                    <Text variant="display">{item.targetReps}</Text>
                    <Text variant="label" color="textMuted">
                      reps
                    </Text>
                  </View>
                ) : (
                  <NumberStepper
                    label={
                      timed ? 'Seconds held' : item.kind === 'amrap' ? 'Reps (as many as possible)' : 'Reps'
                    }
                    size="lg"
                    value={shownReps}
                    min={1}
                    step={1}
                    format={timed ? (v) => `${v} s` : String}
                    onChange={(v) => {
                      resetWatch();
                      setReps(v);
                    }}
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
        {/* A running hold has the bar first, even while a rest counts down. */}
        {item && watch.running ? (
          <>
            <Button
              title={`Stop at ${clockLabel(watch.seconds)}`}
              size="lg"
              testID="stop-hold"
              disabled={watch.seconds === 0}
              onPress={() => {
                record(selectedIndex, watch.seconds);
                resetWatch();
              }}
            />
            <Text variant="callout" color="textMuted" align="center">
              {`Stopwatch running${item.targetReps ? ` · buzz at ${item.targetReps} s` : ''}`}
            </Text>
          </>
        ) : resting ? (
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
              title={doneTitle}
              size="lg"
              testID="done-set"
              onPress={() => {
                record(selectedIndex, item.kind === 'warmup' ? (item.targetReps ?? 0) : shownReps);
                resetWatch();
              }}
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
