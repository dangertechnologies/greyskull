import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise, Outcome, Unit } from '../domain';
import { formatWeight } from '../domain';
import { Button } from '../ui/Button';
import { BottomBar, ScreenScroll } from '../ui/layout';
import { Monogram } from '../ui/Monogram';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { PhotoHeader } from './PhotoHeader';

export interface CelebrationLine {
  exercise: Exercise;
  fromKg: number;
  outcome: Outcome;
  pr: boolean;
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
  const shown = lines.filter((l) => l.outcome.change !== 'none');
  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <ScreenScroll withBottomBar gap={8}>
        <View style={{ marginHorizontal: -t.space[5], marginTop: -t.space[6] }}>
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
          <Card style={{ gap: t.space[6] }}>
            {shown.map((l) => {
              const badge = BADGE[l.outcome.change];
              const fails = l.outcome.next.fails;
              const detail =
                l.outcome.change === 'same'
                  ? `${formatWeight(l.fromKg, unit)} · ${fails} ${fails === 1 ? 'fail' : 'fails'}`
                  : l.outcome.change === 'reps'
                    ? `${formatWeight(l.fromKg, unit)} · target ${l.outcome.next.reps} reps`
                    : `${formatWeight(l.fromKg, unit)} → ${formatWeight(l.outcome.next.weightKg, unit)}`;
              return (
                <View
                  key={l.exercise.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}
                >
                  <Monogram exercise={l.exercise} />
                  <View style={{ flex: 1, gap: t.space[1] }}>
                    <Text variant="bodyStrong">{`${l.exercise.name} ${detail}`}</Text>
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
      <BottomBar>
        <Button title="Back to Today" size="lg" testID="back-to-today" onPress={onHome} />
      </BottomBar>
    </View>
  );
}
