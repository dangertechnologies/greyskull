import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Sparkline } from '../../src/components/Sparkline';
import { useTheme } from '../../src/design/theme';
import type { ActiveProgram, SessionLog } from '../../src/domain';
import { exerciseOfLift, formatWeight, liftKeysOf, project, trim } from '../../src/domain';
import { liftLabel, logPosition, nameOf } from '../../src/format';
import { seriesFor } from '../../src/series';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { ExerciseBadge } from '../../src/ui/ExerciseBadge';
import { Icon } from '../../src/ui/Icon';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

/** Whether a workout belongs to a program: by its program id, or for old history by the program's start. */
const belongsTo = (log: SessionLog, program: ActiveProgram): boolean =>
  log.programId !== undefined ? log.programId === program.id : logPosition(log, program) !== null;

/** The lifts of one program with their trends, and what its next workouts will weigh. */
function ProgramProgress({ program, only }: { program: ActiveProgram; only: boolean }) {
  const sessions = useStore((s) => s.sessions);
  const unit = useStore((s) => s.unit);
  const exercises = useStore((s) => s.exercises);
  const inventory = useStore((s) => s.inventory);
  const nextSession = useStore((s) => s.nextSession);
  const t = useTheme();
  const ids = useMemo(() => liftKeysOf(program), [program]);
  // Only this program's workouts, so a lift two programs share charts each program's own progress.
  const own = useMemo(() => sessions.filter((s) => belongsTo(s, program)), [sessions, program]);
  // `project` reads the programs, exercises, plates, unit and next id: the slices above re-run it on change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slices above stand for the store state
  const upcoming = useMemo(
    () => project(useStore.getState(), program.id, 6),
    [program, exercises, inventory, unit, nextSession],
  );
  const series = useMemo(
    () =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          exercises[exerciseOfLift(id)] ? seriesFor(own, exercises[exerciseOfLift(id)], unit, id) : [],
        ]),
      ),
    [ids, own, exercises, unit],
  );
  const anyTrend = ids.some((id) => series[id].length > 1);
  const title = program.paused ? `${program.name} (paused)` : program.name;

  return (
    <>
      <Section
        label={only ? 'Lifts' : title}
        footer={
          own.some((s) => !s.skipped) && !anyTrend ? 'Trends show once a lift has 2 workouts.' : undefined
        }
        card
      >
        {ids.map((id) => {
          const exercise = exercises[exerciseOfLift(id)];
          if (!exercise) return null;
          const values = series[id];
          const bodyweight = exercise.kind === 'bodyweight';
          const first = values[0];
          const last = values[values.length - 1];
          const delta = values.length > 1 ? last - first : 0;
          const current = bodyweight
            ? last !== undefined
              ? `${trim(last)} reps`
              : 'Bodyweight'
            : formatWeight(program.lifts[id]?.weightKg ?? 0, unit);
          const trend =
            values.length > 1
              ? `${delta >= 0 ? '+' : '−'}${trim(Math.abs(delta), bodyweight || unit === 'kg' ? 2 : 1)} ${bodyweight ? 'reps' : unit} since the start`
              : null;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${only ? '' : `${program.name}: `}${liftLabel(id, exercises)}, ${current}.${trend ? ` ${trend}` : ''}`}
              onPress={() => router.push(`/lift/${id}?program=${program.id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[4],
                minHeight: 72,
                paddingVertical: t.space[3],
                backgroundColor: pressed ? t.color.border : 'transparent',
              })}
            >
              <ExerciseBadge exercise={exercise} size={40} />
              <View style={{ flex: 1, gap: t.space[1] }}>
                <Text variant="bodyStrong">{liftLabel(id, exercises)}</Text>
                {trend ? (
                  <Text variant="caption" color={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textMuted'}>
                    {trend}
                  </Text>
                ) : null}
              </View>
              <Sparkline values={values} />
              <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
                <Text variant="bodyStrong">{current}</Text>
              </View>
              <Icon name="chevron" size={16} color="textMuted" />
            </Pressable>
          );
        })}
      </Section>

      <Section
        label={only ? 'Projection' : `${program.name}: projection`}
        footer="If you hit your reps every time."
        card
      >
        {upcoming.map((s, i) => (
          <View key={s.n} style={{ gap: t.space[1], paddingVertical: t.space[3] }}>
            <Text variant="bodyStrong">{`Workout ${program.position + i + 1} · ${s.dayName}`}</Text>
            <Text variant="callout" color="textMuted">
              {s.lifts
                .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                .map((l) => `${nameOf(exercises, l.exercise, true)} ${formatWeight(l.weightKg, unit)}`)
                .join(' · ')}
            </Text>
          </View>
        ))}
      </Section>
    </>
  );
}

/** Lifts trained in programs that no longer exist: their history stays visible, without a chart to open. */
function EarlierPrograms({ logs }: { logs: SessionLog[] }) {
  const unit = useStore((s) => s.unit);
  const exercises = useStore((s) => s.exercises);
  const t = useTheme();
  const keys = useMemo(
    () => [...new Set(logs.flatMap((l) => l.order.map((id) => l.results[id]?.lift ?? id)))],
    [logs],
  );
  return (
    <Section label="Earlier programs" footer="From programs you removed." card>
      {keys.map((key) => {
        const exercise = exercises[exerciseOfLift(key)];
        if (!exercise) return null;
        const values = seriesFor(logs, exercise, unit, key);
        const last = values[values.length - 1];
        const current =
          last === undefined
            ? ''
            : exercise.kind === 'bodyweight'
              ? `${trim(last)} reps`
              : `${trim(last)} ${unit}`;
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${liftLabel(key, exercises)}, ${current}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4], minHeight: 72 }}
          >
            <ExerciseBadge exercise={exercise} size={40} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {liftLabel(key, exercises)}
            </Text>
            <Sparkline values={values} />
            <Text variant="bodyStrong">{current}</Text>
          </View>
        );
      })}
    </Section>
  );
}

export default function Progress() {
  const programs = useStore((s) => s.programs);
  const sessions = useStore((s) => s.sessions);
  const finished = sessions.filter((s) => !s.skipped).length;
  const earlier = useMemo(
    () => sessions.filter((l) => !l.skipped && !programs.some((p) => belongsTo(l, p))),
    [sessions, programs],
  );

  return (
    <ScreenScroll headerless gap={10}>
      <Text variant="title" accessibilityRole="header">
        Progress
      </Text>

      {finished === 0 ? (
        <EmptyState
          icon="progress"
          title="Nothing to chart yet"
          body="Finish your first workout and your lifts show up here."
        />
      ) : null}

      {programs.map((p) => (
        <ProgramProgress key={p.id} program={p} only={programs.length === 1} />
      ))}

      {earlier.length > 0 ? <EarlierPrograms logs={earlier} /> : null}

      <Section label="History">
        <Button title="See all workouts" variant="secondary" onPress={() => router.push('/history')} />
      </Section>
    </ScreenScroll>
  );
}
