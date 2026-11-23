import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../design/theme';
import { nameOf, weightLabel } from '../format';
import type { SessionApi } from '../hooks/useSession';
import { useStore } from '../store';
import { stepLabel, useGroupTimer } from '../timers/useGroupTimer';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { BottomBar, useGutter } from '../ui/layout';
import { NumberStepper } from '../ui/NumberStepper';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { groupTitle, targetText } from './groupText';
import { clockLabel } from './HoldDial';

const BASE_SIZE = 220;
const STROKE = 12;

interface Props {
  session: SessionApi;
  groupId: string;
  onBack(): void;
}

/**
 * An EMOM or interval block of the workout: before it starts, what it holds and Start; while it runs, the
 * countdown to the next boundary, the current exercise and what comes next, Log (one set per minute or round,
 * the target by default), Pause / Resume, Skip and End early. Sets not logged stay at 0 reps (missed).
 */
export function GroupTimer({ session, groupId, onBack }: Props) {
  const timer = useGroupTimer(session, groupId);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const t = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const size = Math.round(BASE_SIZE * Math.min(1.4, Math.max(1, fontScale)));

  const step = timer?.position?.step ?? 0;
  const current = timer?.steps[step];
  const defaultReps = current?.item.logged
    ? current.item.reps
    : (current?.item.targetReps ?? current?.item.minReps ?? 5);
  const [reps, setReps] = useState(defaultReps);
  useEffect(() => setReps(defaultReps), [defaultReps]);

  if (!timer) return null;
  const { group, steps, position, paused } = timer;
  const letter = steps[0]?.item.group?.label.slice(0, 1) ?? 'A';
  const emom = group.kind === 'emom';
  const heading = emom ? `EMOM ${steps.length}` : `${group.workS ?? 0} s / ${group.restS ?? 0} s`;
  const name = (id: string) => nameOf(exercises, id);
  const detail = (i: (typeof steps)[number]['item']) => {
    const weight = weightLabel(i.weightKg, exercises[i.exerciseId], unit).trim();
    return [targetText(i), weight].filter(Boolean).join(' · ');
  };

  const header = (
    <View
      style={{
        paddingTop: insets.top + t.space[2],
        paddingHorizontal: t.space[2],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <IconButton icon="back" label="Back to Today" onPress={onBack} />
      <Text variant="callout" color="textMuted" style={{ paddingHorizontal: t.space[3] }}>
        {heading}
      </Text>
    </View>
  );

  if (!position) {
    // Not started: what the block holds, then Start.
    return (
      <View style={{ flex: 1, backgroundColor: t.color.background }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 260, gap: t.space[6] }}>
          <Text variant="label" color="textMuted">
            {groupTitle(group, letter, steps.length)}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {emom ? `Every minute for ${steps.length} minutes` : `${steps.length} rounds`}
          </Text>
          <Text color="textMuted">
            {emom
              ? 'Do the set at the start of each minute and rest for what is left of it. Log each set as you go.'
              : `Work ${group.workS ?? 0} s, rest ${group.restS ?? 0} s, every round. Log each round as you go.`}
          </Text>
          <Card style={{ gap: t.space[3] }}>
            {[...new Set(steps.map((s) => s.item.exerciseId))].map((id) => {
              const first = steps.find((s) => s.item.exerciseId === id);
              return first ? (
                <View key={id} style={{ flexDirection: 'row', gap: t.space[3], alignItems: 'baseline' }}>
                  <Text variant="bodyStrong">{first.item.group?.label}</Text>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {name(id)}
                  </Text>
                  <Text color="textMuted">{detail(first.item)}</Text>
                </View>
              ) : null;
            })}
          </Card>
        </ScrollView>
        <BottomBar>
          <Button
            title={emom ? 'Start EMOM' : 'Start intervals'}
            size="lg"
            testID="timer-start"
            onPress={timer.start}
          />
          <Button title="Skip this block" variant="plain" testID="timer-skip-block" onPress={timer.end} />
        </BottomBar>
      </View>
    );
  }

  const resting = position.phase === 'rest';
  const next = steps[step + 1];
  const fraction = position.phaseS > 0 ? 1 - position.remainingS / position.phaseS : 1;
  const r = (size - STROKE) / 2;
  const length = 2 * Math.PI * r;
  const ringColor = resting ? t.color.borderStrong : t.color.accent;
  const nextLine = resting
    ? next
      ? {
          lead: stepLabel(group, step + 1, steps.length),
          rest: `${name(next.item.exerciseId)} · ${detail(next.item)}`,
        }
      : { lead: 'Done', rest: 'then the rest of your workout' }
    : !emom && (group.restS ?? 0) > 0
      ? { lead: `Rest ${group.restS} s`, rest: next ? `then round ${step + 2}` : 'then done' }
      : next
        ? {
            lead: `${stepLabel(group, step + 1, steps.length).split(' of ')[0]} · ${name(next.item.exerciseId)}`,
            rest: detail(next.item),
          }
        : { lead: 'Last one', rest: 'then the rest of your workout' };
  const unitWord = current?.item.timed ? 's' : 'reps';

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      {header}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingBottom: 320,
          gap: t.space[6],
          alignItems: 'center',
        }}
      >
        <View style={{ alignItems: 'center', gap: t.space[2], paddingTop: t.space[4] }}>
          <Text variant="label" color="textMuted" testID="timer-step">
            {stepLabel(group, step, steps.length)}
          </Text>
          <Text variant="title" align="center" accessibilityRole="header">
            {resting ? 'Rest' : current ? name(current.item.exerciseId) : ''}
          </Text>
          {!resting && current ? (
            <Text color="textMuted" align="center">
              {detail(current.item)}
            </Text>
          ) : null}
          {!emom ? (
            <View
              style={{
                backgroundColor: resting ? t.color.surfaceRaised : t.color.chartFill,
                borderRadius: t.radius.pill,
                paddingHorizontal: t.space[5],
                paddingVertical: t.space[2],
              }}
            >
              <Text variant="label" color={resting ? 'textMuted' : 'text'}>
                {resting ? 'Rest' : 'Work'}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          accessible
          accessibilityRole="timer"
          accessibilityLabel={`${position.remainingS} seconds left${paused ? ', paused' : ''}`}
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={t.color.border}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={ringColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${length * (1 - fraction)} ${length}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <Text variant="display" testID="timer-remaining" numberOfLines={1} adjustsFontSizeToFit>
            {clockLabel(position.remainingS)}
          </Text>
          <Text variant="callout" color="textMuted">
            {paused ? 'Paused' : emom ? 'left in this minute' : resting ? 'rest left' : 'work left'}
          </Text>
        </View>

        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: t.space[2] }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {steps.map((s, i) => (
            <View
              key={`${s.item.exerciseId}-${s.item.position}`}
              style={{
                width: steps.length > 20 ? 10 : 22,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === step ? t.color.text : s.item.logged ? t.color.success : t.color.border,
              }}
            />
          ))}
        </View>

        <Card
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.space[3],
            alignItems: 'baseline',
          }}
        >
          <Text variant="label" color="textMuted">
            {resting || emom ? 'Next up' : 'Next'}
          </Text>
          <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
            {nextLine.lead}
          </Text>
          <Text color="textMuted" style={{ flexShrink: 1 }}>
            {nextLine.rest}
          </Text>
        </Card>

        {timer.deniedNotice ? (
          <Text variant="callout" color="textMuted" align="center">
            Notifications are off, so the timer only buzzes while the app is open.
          </Text>
        ) : null}

        {current ? (
          <View style={{ alignSelf: 'stretch' }}>
            <NumberStepper
              label={current.item.timed ? 'Seconds' : 'Reps'}
              value={reps}
              min={1}
              step={1}
              format={current.item.timed ? (v) => `${v} s` : String}
              onChange={setReps}
            />
          </View>
        ) : null}
      </ScrollView>

      <BottomBar>
        {current ? (
          <Button
            title={
              current.item.logged
                ? `Logged ${current.item.reps} ${unitWord} · update to ${reps}`
                : `Log ${reps} ${unitWord}`
            }
            size="lg"
            testID="timer-log"
            onPress={() => session.record(current.index, reps)}
          />
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
          <View style={{ flexGrow: 1, flexBasis: 96 }}>
            <Button
              title={paused ? 'Resume' : 'Pause'}
              icon="timer"
              variant="secondary"
              testID="timer-pause"
              onPress={paused ? timer.resume : timer.pause}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 96 }}>
            <Button title="Skip" icon="skip" variant="secondary" testID="timer-skip" onPress={timer.skip} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 96 }}>
            <Button title="End early" variant="destructive" testID="timer-end" onPress={timer.end} />
          </View>
        </View>
      </BottomBar>
    </View>
  );
}
