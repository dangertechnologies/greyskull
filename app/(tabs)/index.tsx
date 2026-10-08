import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { LiftRow } from '../../src/components/LiftRow';
import { WorkoutRow } from '../../src/components/WorkoutRow';
import { useTheme } from '../../src/design/theme';
import { formatWeight, project, sessionFor, sessionWeightKg } from '../../src/domain';
import { intensityLabel, nameOf, schemeLabel, weekOf } from '../../src/format';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { useSnackbar } from '../../src/ui/Snackbar';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

/** The week as one dot per session: done, skipped, next, or still to come. */
function WeekStrip({ first, perWeek, next }: { first: number; perWeek: number; next: number }) {
  const t = useTheme();
  const sessions = useStore((s) => s.sessions);
  return (
    <View
      accessible
      accessibilityLabel={`This week: ${Math.min(Math.max(next - first, 0), perWeek)} of ${perWeek} sessions done`}
      style={{ flexDirection: 'row', gap: t.space[3] }}
    >
      {Array.from({ length: perWeek }, (_, i) => first + i).map((n) => {
        const log = sessions.find((s) => s.n === n);
        const isNext = n === next;
        return (
          <View
            key={n}
            style={{
              width: 40,
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
  const { program, lifts, nextSession, draft, sessions, unit, inventory, exercises, needsWeightConfirm } =
    state;
  const snackbar = useSnackbar();
  const t = useTheme();
  const upcoming = useMemo(() => project(state, 3), [state]);

  if (program === null) return <Redirect href="/setup" />;
  if (needsWeightConfirm) return <Redirect href="/setup/confirm" />;

  const session = sessionFor(program, nextSession);
  const perWeek = program.sessionsPerWeek;
  const week = weekOf(nextSession, perWeek);
  const light = intensityLabel(session.dayName, session.intensity);
  const recent = [...sessions].reverse().slice(0, 3);

  const skip = () => {
    state.skipSession();
    snackbar.show({
      message: 'Workout skipped',
      action: { label: 'Undo', onPress: () => useStore.getState().undoSkip() },
    });
  };

  return (
    <>
      <ScreenScroll headerless withBottomBar gap={10}>
        <View style={{ gap: t.space[2] }}>
          <Text variant="label" color="textMuted">{`Week ${week}`}</Text>
          <Text variant="title" accessibilityRole="header">
            {session.dayName}
          </Text>
          {light ? (
            <Text variant="callout" color="textMuted">{`${light} of your working weights`}</Text>
          ) : null}
        </View>

        <WeekStrip first={(week - 1) * perWeek} perWeek={perWeek} next={nextSession} />

        <Card style={{ gap: t.space[5] }}>
          {session.slots.map(({ exercise: id, scheme }) => {
            const exercise = exercises[id];
            if (!exercise) return null;
            const kg =
              draft?.n === nextSession
                ? (draft.results[id]?.weightKg ?? 0)
                : sessionWeightKg(lifts[id]?.weightKg ?? 0, session.intensity, exercise, inventory, unit);
            return (
              <LiftRow
                key={id}
                exercise={exercise}
                kg={kg}
                schemeLabel={schemeLabel(scheme, lifts[id]?.reps)}
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

        <Section label="Coming up">
          <View style={{ gap: t.space[3] }}>
            {upcoming.slice(1).map((s) => (
              <Text key={s.n} variant="callout" color="textMuted">
                {`${s.dayName} · ${s.lifts
                  .filter((l) => exercises[l.exercise]?.kind !== 'bodyweight')
                  .map(
                    (l) =>
                      `${nameOf(exercises, l.exercise, true)} ${formatWeight(l.weightKg, unit).replace(/ (kg|lb)$/, '')}`,
                  )
                  .join(' · ')}`}
              </Text>
            ))}
          </View>
        </Section>

        {recent.length > 0 ? (
          <Section label="Recent">
            <View>
              {recent.map((log) => (
                <WorkoutRow key={log.n} log={log} />
              ))}
            </View>
            <Button title="See all history" variant="plain" onPress={() => router.push('/history')} />
          </Section>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button
          title={draft ? 'Resume workout' : 'Start workout'}
          size="lg"
          testID="start-session"
          onPress={() => router.push(`/session/${nextSession}`)}
        />
      </BottomBar>
    </>
  );
}
