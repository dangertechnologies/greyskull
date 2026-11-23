import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { LiftRow } from '../../src/components/LiftRow';
import { WorkoutRow } from '../../src/components/WorkoutRow';
import { useTheme } from '../../src/design/theme';
import type { ActiveProgram } from '../../src/domain';
import { fiveThreeOneSets, formatWeight, project, sessionFor, sessionWeightKg } from '../../src/domain';
import { intensityLabel, logPosition, nameOf, schemeLabel, weekLabel, weekOf } from '../../src/format';
import { useProgram, useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { useSnackbar } from '../../src/ui/Snackbar';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

/** The week as one dot per session of the program: done, skipped, next, or still to come. */
function WeekStrip({ program, first, perWeek }: { program: ActiveProgram; first: number; perWeek: number }) {
  const t = useTheme();
  const sessions = useStore((s) => s.sessions);
  const next = program.position;
  return (
    <View
      accessible
      accessibilityLabel={`This week: ${Math.min(Math.max(next - first, 0), perWeek)} of ${perWeek} sessions done`}
      style={{ flexDirection: 'row', gap: t.space[3] }}
    >
      {Array.from({ length: perWeek }, (_, i) => first + i).map((n) => {
        const log = sessions.find((s) => logPosition(s, program) === n);
        const isNext = n === next;
        return (
          <View
            key={n}
            style={{
              width: 40,
              flexShrink: 1,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: log && !log.skipped ? t.color.success : 'transparent',
              borderWidth: 2,
              borderColor: log
                ? log.skipped
                  ? t.color.warning
                  : t.color.success
                : isNext
                  ? t.color.accent
                  : t.color.border,
            }}
          >
            {log && !log.skipped ? (
              <Icon name="check" size={18} color="background" />
            ) : (
              <Text variant="caption" color={log?.skipped ? 'warning' : isNext ? 'accent' : 'textMuted'}>
                {log?.skipped ? '–' : String((n % perWeek) + 1)}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function Today() {
  const state = useStore();
  const { programs, draft, sessions, unit, inventory, exercises, needsWeightConfirm } = state;
  const program = useProgram();
  const snackbar = useSnackbar();
  const t = useTheme();
  const upcoming = useMemo(() => (program ? project(state, program.id, 3) : []), [state, program]);

  if (programs.length === 0) return <Redirect href="/setup" />;
  if (needsWeightConfirm) return <Redirect href="/setup/confirm" />;
  if (!program) {
    return (
      <ScreenScroll headerless>
        <EmptyState
          icon="plan"
          title="All programs are paused"
          body="Resume a program to see its next workout."
        />
      </ScreenScroll>
    );
  }

  const { lifts } = program;
  // The workout in progress of this program, shown in place of the plain plan.
  const current = draft?.programId === program.id ? draft : null;
  const session = sessionFor(program);
  const perWeek = program.sessionsPerWeek;
  const week = weekOf(program.position, perWeek);
  const light = intensityLabel(session.dayName, session.intensity);
  const recent = [...sessions].reverse().slice(0, 3);

  const skip = () => {
    state.skipSession(program.id);
    snackbar.show({
      message: 'Workout skipped',
      action: { label: 'Undo', onPress: () => useStore.getState().undoSkip(program.id) },
    });
  };

  return (
    <>
      <ScreenScroll headerless withBottomBar gap={10}>
        <View style={{ gap: t.space[2] }}>
          <Text variant="label" color="textMuted">
            {weekLabel(program)}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {session.dayName}
          </Text>
          {light ? (
            <Text variant="callout" color="textMuted">{`${light} of your working weights`}</Text>
          ) : null}
        </View>

        <WeekStrip program={program} first={(week - 1) * perWeek} perWeek={perWeek} />

        <Card style={{ gap: t.space[5] }}>
          {session.slots.map(({ exercise: id, lift, scheme, progression, week }) => {
            const exercise = exercises[id];
            if (!exercise) return null;
            const sets = current
              ? current.results[id]?.sets
              : progression === '531'
                ? fiveThreeOneSets(lifts[lift]?.weightKg ?? 0, week ?? 0, exercise, inventory, unit)
                : undefined;
            const kg = current
              ? (current.results[id]?.weightKg ?? 0)
              : progression === '531'
                ? Math.max(...(sets ?? []).map((s) => s.kg ?? 0))
                : sessionWeightKg(lifts[lift]?.weightKg ?? 0, session.intensity, exercise, inventory, unit);
            return (
              <LiftRow
                key={id}
                exercise={exercise}
                kg={kg}
                sets={sets}
                schemeLabel={schemeLabel(scheme, lifts[lift]?.reps)}
                unit={unit}
                inventory={inventory}
              />
            );
          })}
        </Card>

        <View style={{ alignItems: 'center' }}>
          <Button title="Skip this workout" variant="plain" testID="skip-session" onPress={skip} />
        </View>

        <View style={{ height: t.space[2] }} />

        <Section label="Coming up" card>
          {upcoming.slice(1).map((s) => (
            <Text key={s.n} variant="callout" color="textMuted" style={{ paddingVertical: t.space[3] }}>
              {`${s.dayName} · ${s.lifts
                .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                .map(
                  (l) =>
                    `${nameOf(exercises, l.exercise, true)} ${formatWeight(l.weightKg, unit).replace(/ (kg|lb)$/, '')}`,
                )
                .join(' · ')}`}
            </Text>
          ))}
        </Section>

        {recent.length > 0 ? (
          <Section label="Recent" card>
            {recent.map((log) => (
              <WorkoutRow key={log.n} log={log} />
            ))}
            <Button title="See all history" variant="plain" onPress={() => router.push('/history')} />
          </Section>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button
          title={draft ? 'Resume workout' : 'Start workout'}
          size="lg"
          testID="start-session"
          onPress={() =>
            router.push(draft ? `/session/${draft.n}` : `/session/${state.nextSession}?program=${program.id}`)
          }
        />
      </BottomBar>
    </>
  );
}
