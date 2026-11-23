import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import type { Ladder, Scheme, SessionLog } from '../../src/domain';
import { getLadder, stepIn } from '../../src/domain';
import { formatDate, nameOf } from '../../src/format';
import { useProgramById } from '../../src/hooks/useProgramById';
import { useStore } from '../../src/store';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { ScreenScroll } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';
import { stepScheme, topOf, unlockRule } from '../../src/views/ladder';

/** Best result at one step of a ladder: "3×6 on 21 Nov 2026" (every set at least that many), or null. */
function bestAt(sessions: SessionLog[], ladder: Ladder, step: number): string | null {
  let best: { sets: number; reps: number; date: string; timed: boolean } | null = null;
  for (const log of sessions) {
    if (log.skipped) continue;
    for (const r of Object.values(log.results)) {
      if (r.lift !== ladder.id || r.step !== step || r.sets.length === 0) continue;
      const reps = Math.min(...r.sets.map((s) => s.reps));
      if (reps > 0 && (!best || reps >= best.reps))
        best = { sets: r.sets.length, reps, date: log.finishedAt ?? log.startedAt, timed: !!r.timed };
    }
  }
  return best ? `${best.sets}×${best.reps}${best.timed ? ' s' : ''} on ${formatDate(best.date)}` : null;
}

/** A ladder's steps from easiest to hardest: done, current (with its unlock rule) and next. Tap a step to move there. */
export default function LadderScreen() {
  const { id, program: programParam } = useLocalSearchParams<{ id: string; program?: string }>();
  const ladder = getLadder(id);
  const program = useProgramById(programParam);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const setLiftStep = useStore((s) => s.setLiftStep);
  const t = useTheme();

  if (!ladder || (programParam && !program)) {
    return (
      <ScreenScroll>
        <Stack.Screen options={{ title: 'Ladder' }} />
        <EmptyState
          icon="lift"
          title={ladder ? 'Program not found' : 'Ladder not found'}
          body={ladder ? 'It may have been removed.' : undefined}
          action={{ title: 'Programs', onPress: () => router.replace('/plan') }}
        />
      </ScreenScroll>
    );
  }

  const lift = program?.lifts[ladder.id];
  // Without a program, or before the ladder has a state, nothing is done and no step is current.
  const current = lift ? stepIn(ladder, lift.step) : -1;
  const slotScheme = program?.days.flatMap((d) => d.slots).find((s) => s.ladder === ladder.id)?.scheme as
    | Scheme
    | undefined;
  const name = (step: number) => nameOf(exercises, ladder.steps[step].exercise);

  const choose = (step: number) => {
    if (!program || step === current) return;
    Alert.alert(`Start at ${name(step)}?`, 'Your next sets of this ladder use this step.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start here', onPress: () => setLiftStep(program.id, ladder.id, step) },
    ]);
  };

  return (
    <ScreenScroll gap={6}>
      <Stack.Screen options={{ title: ladder.name }} />
      <Text color="textMuted">
        {current >= 0
          ? `Step ${current + 1} of ${ladder.steps.length} · tap a step to start there`
          : `${ladder.steps.length} steps, easiest first`}
      </Text>
      <View style={{ gap: t.space[2] }}>
        {ladder.steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'next';
          const top = topOf(stepScheme(ladder, i, slotScheme));
          const best = state === 'current' ? bestAt(sessions, ladder, i) : null;
          const rule = state === 'current' ? unlockRule(ladder, i, slotScheme) : undefined;
          const label = `${i + 1}. ${name(i)}`;
          return (
            <Pressable
              key={s.exercise}
              testID={`ladder-step-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${state === 'done' ? 'done' : state === 'current' ? 'current step' : 'not reached'}${top ? `, ${top}` : ''}${rule ? `, ${rule}` : ''}`}
              accessibilityState={{ selected: state === 'current', disabled: !program }}
              disabled={!program}
              onPress={() => choose(i)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[4],
                minHeight: 56,
                padding: state === 'current' ? t.space[4] : t.space[2],
                borderRadius: t.radius.xl,
                borderWidth: state === 'current' ? 2 : 0,
                borderColor: t.color.accent,
                backgroundColor:
                  state === 'current' ? t.color.surface : pressed ? t.color.border : 'transparent',
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: t.radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: state === 'done' ? t.color.success : 'transparent',
                  borderWidth: state === 'done' ? 0 : 2,
                  borderColor: state === 'current' ? t.color.accent : t.color.borderStrong,
                }}
              >
                {state === 'done' ? <Icon name="check" size={18} color="background" /> : null}
                {state === 'current' ? (
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: t.radius.pill,
                      backgroundColor: t.color.accent,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: t.space[1] }}>
                <Text
                  variant={state === 'current' ? 'headline' : 'body'}
                  color={state === 'done' ? 'textMuted' : 'text'}
                >
                  {label}
                </Text>
                {state === 'current' ? (
                  <Text variant="callout" color="textMuted">
                    {best ? `You are here · best ${best}` : 'You are here'}
                  </Text>
                ) : null}
                {rule ? (
                  <Text variant="callout" color="accent">
                    {rule}
                  </Text>
                ) : null}
                {s.band ? (
                  <Text variant="caption" color="textMuted">
                    With an assistance band
                  </Text>
                ) : null}
              </View>
              {top && state !== 'current' ? (
                <Text variant="callout" color="textMuted">
                  {top}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScreenScroll>
  );
}
