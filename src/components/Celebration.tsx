import { useRef } from 'react';
import { type HostInstance, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise, Outcome, Unit } from '../domain';
import { weightLabel } from '../format';
import { shareView } from '../shareImage';
import { Button } from '../ui/Button';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { BottomBar, ScreenScroll, useGutter } from '../ui/layout';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { Confetti } from './Confetti';
import { PhotoHeader } from './PhotoHeader';

export interface CelebrationLine {
  exercise: Exercise;
  fromKg: number;
  outcome: Outcome;
  pr: boolean;
  /** Ladder: the name of the step the lift moved up to. */
  step?: string;
  /** Ladder: the label of the lighter band the lift moved to. */
  band?: string;
  /** Held for time: targets are seconds. */
  timed?: boolean;
}

/** "Bench 40 kg → 42.5 kg", "Dips → +2.5 kg", "Step up: Negative pull-up", "Arch hang · target 15 s". */
function lineText(l: CelebrationLine, unit: Unit): string {
  if (l.step) return `Step up: ${l.step}`;
  const { name } = l.exercise;
  if (l.band !== undefined) return `${name} · Lighter band${l.band ? `: ${l.band}` : ''}`;
  const from = weightLabel(l.fromKg, l.exercise, unit);
  const head = from ? `${name}${from}` : name;
  const { next, change } = l.outcome;
  if (change === 'same') return `${head} · ${next.fails} ${next.fails === 1 ? 'fail' : 'fails'}`;
  if (change === 'reps') return `${head} · target ${next.reps}${l.timed ? ' s' : ' reps'}`;
  return `${head} →${weightLabel(next.weightKg, l.exercise, unit) || ' bodyweight'}`;
}

const BADGE: Record<
  Outcome['change'],
  { text: string; color: 'success' | 'warning' | 'danger' | 'textMuted' }
> = {
  up: { text: '↑ Up', color: 'success' },
  double: { text: '↑↑ Double jump', color: 'success' },
  reps: { text: '+1 rep next time', color: 'success' },
  same: { text: 'Same weight', color: 'warning' },
  deload: { text: '↓ Deload', color: 'danger' },
  none: { text: '', color: 'textMuted' },
};

export function Celebration({
  lines,
  unit,
  nextUp,
  onHome,
}: {
  lines: CelebrationLine[];
  unit: Unit;
  /** "Wed · Bench 62.5 · Deadlift 100" */
  nextUp?: string;
  onHome(): void;
}) {
  const t = useTheme();
  const gutter = useGutter();
  const summaryRef = useRef<HostInstance>(null);
  const shown = lines.filter((l) => l.outcome.change !== 'none');
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScreenScroll withBottomBar edgeToEdge gap={8}>
        <View style={{ marginHorizontal: -gutter }}>
          <PhotoHeader image="rest" fraction={0.28}>
            <View style={{ flex: 1 }} />
            <Text variant="title" color="onPhoto" accessibilityRole="header">
              Workout complete
            </Text>
          </PhotoHeader>
        </View>
        <View style={{ height: t.space[4] }} />
        {shown.length === 0 ? <Text color="textMuted">Nice work. Weights stay as they are.</Text> : null}
        {shown.length > 0 ? (
          <View ref={summaryRef} collapsable={false} style={{ backgroundColor: t.color.background }}>
            <Card style={{ gap: t.space[6] }}>
              {shown.map((l) => {
                // A hold's target grows by seconds, not by a rep.
                const badge =
                  l.timed && l.outcome.change === 'reps'
                    ? { ...BADGE.reps, text: 'Longer hold next time' }
                    : BADGE[l.outcome.change];
                return (
                  <View
                    key={l.exercise.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}
                  >
                    <ExerciseBadge exercise={l.exercise} />
                    <View style={{ flex: 1, gap: t.space[1] }}>
                      <Text variant="bodyStrong">{lineText(l, unit)}</Text>
                      <View style={{ flexDirection: 'row', gap: t.space[3] }}>
                        <Text variant="caption" color={badge.color}>
                          {badge.text}
                        </Text>
                        {l.pr ? (
                          <Text variant="caption" color="accent">
                            Personal record
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}
        {nextUp ? (
          <View style={{ gap: t.space[2], paddingTop: t.space[6] }}>
            <Text variant="label" color="textMuted">
              Next workout
            </Text>
            <Text>{nextUp}</Text>
          </View>
        ) : null}
      </ScreenScroll>
      {shown.some((l) => l.outcome.change !== 'same' && l.outcome.change !== 'deload') ? <Confetti /> : null}
      <BottomBar>
        {shown.length > 0 ? (
          <Button
            title="Share summary"
            variant="secondary"
            icon="share"
            testID="share-summary"
            onPress={() => void shareView(summaryRef).catch(() => undefined)}
          />
        ) : null}
        <Button title="Back to Today" size="lg" testID="back-to-today" onPress={onHome} />
      </BottomBar>
    </View>
  );
}
