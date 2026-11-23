import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { LiftRow } from '../../src/components/LiftRow';
import { CategoryPill, Pill, ProgramBadge } from '../../src/components/ProgramBits';
import { getPlan } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import type { ActiveProgram, ProgressionModel } from '../../src/domain';
import { easedLifts, fiveThreeOneSets, MAX_TEXT, sessionFor, sessionWeightKg } from '../../src/domain';
import { intensityLabel, liftLabel, nameOf, schemeLabel, weekLabel } from '../../src/format';
import { useProgramById } from '../../src/hooks/useProgramById';
import { goBackOr } from '../../src/navigation';
import { nameTaken } from '../../src/programPicker';
import { setCounts, startWorkout } from '../../src/programStart';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ListRow } from '../../src/ui/ListRow';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { Section } from '../../src/ui/Section';
import { Sheet } from '../../src/ui/Sheet';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

const PROGRESSION_LABEL: Record<ProgressionModel, string> = {
  amrap: 'Last set as many reps as possible',
  linear: 'Add weight when every set is done',
  double: 'Add reps, then weight',
  stages: 'Move through stages',
  '531': '5/3/1 cycles',
  ladder: 'Move up a ladder step',
};

/** The weights of the program's next workout, as Today showed them when it had one program. */
function NextWorkout({ program }: { program: ActiveProgram }) {
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const inventory = useStore((s) => s.inventory);
  const bands = useStore((s) => s.bands);
  const breakDeload = useStore((s) => s.breakDeload);
  const sessions = useStore((s) => s.sessions);
  // After a break the workout starts from eased lifts: show those weights, not the stored ones.
  const { lifts, session } = useMemo(() => {
    const eased = easedLifts(
      { breakDeload, exercises, inventory, unit, bands, sessions },
      program,
      Date.now(),
    );
    const lifts = { ...program.lifts, ...eased.lifts };
    return { lifts, session: sessionFor(program, lifts) };
  }, [program, breakDeload, exercises, inventory, unit, bands, sessions]);
  return (
    <Card style={{ gap: t.space[5] }}>
      {session.slots.map(({ exercise: id, lift, scheme, progression, week }) => {
        const exercise = exercises[id];
        if (!exercise) return null;
        const sets =
          progression === '531'
            ? fiveThreeOneSets(lifts[lift]?.weightKg ?? 0, week ?? 0, exercise, inventory, unit)
            : undefined;
        const kg =
          progression === '531'
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
  );
}

export default function ProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useProgramById(id);
  const exercises = useStore((s) => s.exercises);
  const draft = useStore((s) => s.draft);
  const t = useTheme();
  const [renaming, setRenaming] = useState<string | null>(null);
  const programs = useStore((s) => s.programs);
  if (!program) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.background }}>
        <Stack.Screen options={{ title: 'Program' }} />
        <ScreenScroll gap={6}>
          <Text variant="headline" accessibilityRole="header">
            Program not found
          </Text>
          <Text color="textMuted">It may have been removed.</Text>
          <Button title="Back" variant="secondary" onPress={() => goBackOr('/')} />
        </ScreenScroll>
      </View>
    );
  }

  const plan = getPlan(program.template);
  const session = sessionFor(program);
  const light = intensityLabel(session.dayName, session.intensity);
  const open = draft?.programId === program.id;

  const logged = open && draft ? setCounts(draft).done : 0;
  const nameUsed =
    renaming !== null &&
    nameTaken(
      renaming,
      programs.filter((p) => p.id !== program.id).map((p) => p.name),
    );

  const remove = () =>
    Alert.alert(
      `Remove ${program.name}?`,
      `Its past workouts stay in History. Its working weights are deleted.${
        open
          ? ` This also discards your workout in progress (${logged} ${logged === 1 ? 'set' : 'sets'} logged).`
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove program',
          style: 'destructive',
          onPress: () => {
            useStore.getState().removeProgram(program.id);
            goBackOr('/');
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: program.name }} />
      <ScreenScroll withBottomBar gap={10}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          <ProgramBadge program={program} />
          <CategoryPill program={program} />
          {open ? (
            <Pill label="Draft open" tone="warning" />
          ) : program.paused ? (
            <Pill label="Paused" />
          ) : (
            <Pill label="Active" tone="success" />
          )}
          {plan?.status === 'experimental' ? <Pill label="Experimental" tone="warning" /> : null}
        </View>
        {plan ? (
          <Text variant="callout" color="textMuted">
            {plan.summary}
          </Text>
        ) : null}

        <Card style={{ gap: t.space[1] }}>
          <Text variant="label" color="textMuted">
            Next
          </Text>
          <Text variant="headline">{`${session.dayName} · ${weekLabel(program)}`}</Text>
          {light ? (
            <Text variant="callout" color="textMuted">{`${light} of your working weights`}</Text>
          ) : null}
        </Card>

        {program.paused ? null : <NextWorkout program={program} />}

        <Section label="Rules" card>
          <View style={{ gap: t.space[1], paddingVertical: t.space[4] }}>
            <Text variant="bodyStrong">{PROGRESSION_LABEL[program.rules.progression ?? 'amrap']}</Text>
            <Text variant="callout" color="textMuted">
              {`Deload ${Math.round(program.rules.deloadPct * 100)} % after ${program.rules.failsBeforeDeload} ${program.rules.failsBeforeDeload === 1 ? 'miss' : 'misses'} · Warm-ups ${program.rules.warmups ? 'on' : 'off'}`}
            </Text>
          </View>
        </Section>

        <Section label="Sessions a week">
          <NumberStepper
            label="Training days per week"
            value={program.sessionsPerWeek}
            min={1}
            max={7}
            step={1}
            format={String}
            onChange={(days) => useStore.getState().setSessionsPerWeek(program.id, days)}
          />
        </Section>

        <Section label="Days" card>
          {program.days.map((day) => (
            <View key={day.name} style={{ gap: t.space[1], paddingVertical: t.space[4] }}>
              <Text variant="bodyStrong">
                {day.intensity && day.intensity < 1
                  ? `${day.name} · ${Math.round(day.intensity * 100)} %`
                  : day.name}
              </Text>
              {day.slots.map((slot) => {
                const ids = typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise;
                return (
                  <Text key={ids.join('/')} variant="callout" color="textMuted">
                    {`${slot.lift ? liftLabel(slot.lift, exercises) : ids.map((x) => nameOf(exercises, x)).join(' / ')} · ${schemeLabel(slot.scheme)}`}
                  </Text>
                );
              })}
            </View>
          ))}
        </Section>

        <Section label="Edit" card>
          <ListRow
            title="Days and exercises"
            accessory="chevron"
            onPress={() => router.push(`/setup/days?edit=1&program=${program.id}`)}
          />
          <ListRow
            title="Progression rules"
            accessory="chevron"
            onPress={() => router.push(`/plan/rules?program=${program.id}`)}
          />
          <ListRow title="Rename" accessory="chevron" onPress={() => setRenaming(program.name)} />
          <ListRow
            title="Exercises"
            subtitle="Form tips, videos, custom exercises"
            accessory="chevron"
            onPress={() => router.push('/exercises')}
          />
          <ListRow
            title="Duplicate & edit"
            subtitle="Copy it into My programs to change"
            accessory="chevron"
            onPress={() => router.push(`/builder/new?program=${program.id}`)}
          />
          <ListRow
            title="Change plan"
            subtitle="Keeps this program's weights and history"
            accessory="chevron"
            onPress={() => router.push(`/setup/plan?change=1&program=${program.id}`)}
          />
        </Section>

        <View style={{ gap: t.space[2] }}>
          <Button
            title={program.paused ? 'Resume program' : 'Pause program'}
            variant="plain"
            testID="pause-program"
            disabled={open}
            onPress={() => useStore.getState().pauseProgram(program.id, !program.paused)}
          />
          {open ? (
            <Text variant="callout" color="textMuted" align="center">
              Finish or discard the workout first.
            </Text>
          ) : null}
          <Button title="Remove program" variant="destructive" testID="remove-program" onPress={remove} />
        </View>
      </ScreenScroll>

      {program.paused ? null : (
        <BottomBar>
          <Button
            title={open ? 'Resume workout' : 'Start workout'}
            size="lg"
            testID={`start-${program.id}`}
            onPress={() => startWorkout(program)}
          />
        </BottomBar>
      )}

      <Sheet visible={renaming !== null} onClose={() => setRenaming(null)} title="Rename program">
        <TextField
          label="Name"
          value={renaming ?? ''}
          onChangeText={setRenaming}
          maxLength={MAX_TEXT}
          autoFocus
          returnKeyType="done"
        />
        {nameUsed ? (
          <Text variant="callout" color="danger">
            Another program already has this name.
          </Text>
        ) : null}
        <Button
          title="Save"
          disabled={!renaming?.trim() || nameUsed}
          testID="rename-save"
          onPress={() => {
            useStore.getState().renameProgram(program.id, renaming ?? '');
            setRenaming(null);
          }}
        />
      </Sheet>
    </View>
  );
}
