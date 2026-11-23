import { router } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Ladder, ResolvedSlot, SessionLog } from '../domain';
import { getLadder, stepIn } from '../domain';
import { nameOf } from '../format';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { unlockRule } from './ladder';

/** The draft's ladder slot for an exercise, with its ladder and whole step; undefined for other exercises. */
export function ladderSlot(
  draft: SessionLog,
  exerciseId: string,
): { slot: ResolvedSlot; ladder: Ladder; step: number } | undefined {
  const slot = draft.slots?.find((s) => s.exercise === exerciseId);
  const ladder = slot?.ladder ? getLadder(slot.ladder) : undefined;
  return slot && ladder ? { slot, ladder, step: stepIn(ladder, slot.step) } : undefined;
}

/** "Pull-up progression · step 4 of 6" */
export const ladderLine = (ladder: Ladder, step: number): string =>
  `${ladder.name} · step ${step + 1} of ${ladder.steps.length}`;

/**
 * A ladder exercise in a workout: Easier / Harder (moves the ladder and swaps the exercise while none of its sets
 * is logged), the band in use, and what it takes to reach the next step. `compact` for the one-page view.
 */
export function LadderPanel({
  draft,
  exerciseId,
  compact = false,
}: {
  draft: SessionLog;
  exerciseId: string;
  compact?: boolean;
}) {
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const setLiftStep = useStore((s) => s.setLiftStep);
  const found = ladderSlot(draft, exerciseId);
  const programId = draft.programId;
  if (!found || !programId) return null;
  const { slot, ladder, step } = found;
  const result = draft.results[exerciseId];
  const locked = result?.sets.some((s) => s.reps > 0) ?? false;
  const move = (to: number) => setLiftStep(programId, slot.lift, to);
  const next = ladder.steps[step + 1];
  const rule = unlockRule(ladder, step, slot.scheme);
  const band = result?.band?.label;

  const buttons = (
    <View style={{ gap: t.space[2] }}>
      <View style={{ flexDirection: 'row', gap: t.space[3] }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Easier"
            icon="down"
            variant="secondary"
            testID="ladder-easier"
            disabled={locked || step === 0}
            accessibilityHint="Moves this ladder one step down"
            onPress={() => move(step - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Harder"
            icon="up"
            variant="secondary"
            testID="ladder-harder"
            disabled={locked || step >= ladder.steps.length - 1}
            accessibilityHint="Moves this ladder one step up"
            onPress={() => move(step + 1)}
          />
        </View>
      </View>
      {locked ? (
        <Text variant="caption" color="textMuted">
          Sets are logged at this step. Change it in the next workout.
        </Text>
      ) : null}
    </View>
  );

  if (compact) {
    return (
      <View style={{ gap: t.space[3] }}>
        <Text variant="callout" color="textMuted">
          {[ladderLine(ladder, step), band ? `band: ${band}` : null].filter(Boolean).join(' · ')}
        </Text>
        {buttons}
      </View>
    );
  }

  return (
    <View style={{ gap: t.space[4] }}>
      {buttons}
      <Card style={{ gap: t.space[4] }}>
        {band ? (
          <View style={{ gap: t.space[1] }}>
            <Text variant="bodyStrong">Band</Text>
            <Text variant="callout" color="textMuted">
              {band}
            </Text>
          </View>
        ) : null}
        <View style={{ gap: t.space[1] }}>
          <Text variant="bodyStrong">{next ? 'Next step' : 'Top of the ladder'}</Text>
          <Text variant="callout" color="textMuted">
            {[next ? nameOf(exercises, next.exercise) : null, rule].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Button
          title="See the ladder"
          variant="plain"
          testID="see-ladder"
          onPress={() => router.push(`/ladder/${ladder.id}?program=${programId}`)}
        />
      </Card>
    </View>
  );
}
