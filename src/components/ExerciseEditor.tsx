import { router, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Equipment, Exercise, Kind, Muscle } from '../domain';
import { trim } from '../domain';
import { exerciseFromForm, formFrom, LIMITS, linkProblem } from '../exerciseEdit';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../exerciseFilter';
import { customId } from '../exerciseId';
import { goBackOr } from '../navigation';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ListRow } from '../ui/ListRow';
import { BottomBar, ScreenScroll } from '../ui/layout';
import { NumberStepper } from '../ui/NumberStepper';
import { Section } from '../ui/Section';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'barbell', label: 'Barbell' },
  { kind: 'dumbbell', label: 'Dumbbell' },
  { kind: 'kettlebell', label: 'Kettlebell' },
  { kind: 'machine', label: 'Machine' },
  { kind: 'bodyweight', label: 'Bodyweight' },
];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

function ChipGroup<T extends string>({
  values,
  labels,
  selected,
  onToggle,
}: {
  values: T[];
  labels: Record<T, string>;
  selected: T[];
  onToggle(value: T): void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], paddingVertical: t.space[4] }}>
      {values.map((v) => (
        <Chip
          key={v}
          role="checkbox"
          label={labels[v]}
          selected={selected.includes(v)}
          onPress={() => onToggle(v)}
        />
      ))}
    </View>
  );
}

/** A type chip; a built-in keeps its type, so its chips are disabled (dimmed, announced as disabled). */
function KindChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 56,
        paddingHorizontal: t.space[4],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.color.accent : t.color.borderStrong,
        backgroundColor: selected ? t.color.chartFill : 'transparent',
        opacity: disabled && !selected ? 0.45 : 1,
      }}
    >
      <Text variant="bodyStrong" color={selected ? 'accent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Text a built-in ships with: shown, not editable, because the app's version replaces it on every launch. */
function Locked({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space[2] }}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text color="textMuted">{children}</Text>
    </View>
  );
}

/**
 * Creates a custom exercise or edits one. A built-in can change only what `USER_FIELDS` allows (name,
 * abbreviation, equipment, muscles, timed, increments); its description, tips and links come with the app.
 */
export function ExerciseEditor({ exercise }: { exercise?: Exercise }) {
  const exercises = useStore((s) => s.exercises);
  const upsertExercise = useStore((s) => s.upsertExercise);
  const deleteExercise = useStore((s) => s.deleteExercise);
  const t = useTheme();
  const [form, setForm] = useState(() => formFrom(exercise));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const builtIn = !!exercise && !exercise.custom; // built-ins keep their kind
  const videoProblem = builtIn ? null : linkProblem(form.video);
  const urlProblem = builtIn ? null : linkProblem(form.url);
  const valid = form.name.trim().length > 0 && !videoProblem && !urlProblem;
  const weighted = form.kind === 'dumbbell' || form.kind === 'machine' || form.kind === 'kettlebell';

  const save = () => {
    upsertExercise(exerciseFromForm(form, exercise, (name) => customId(name, exercises)));
    goBackOr('/exercises');
  };

  const remove = () => {
    if (!exercise) return;
    const days = deleteExercise(exercise.id);
    if (days.length > 0) {
      Alert.alert(
        'Still in your program',
        `Remove it from ${days.join(', ')} first (Settings → Edit program).`,
      );
    } else {
      router.dismissTo('/exercises');
    }
  };

  const weightRow = (
    label: string,
    key: 'incKg' | 'incLb' | 'stepKg' | 'stepLb' | 'barKg' | 'barLb',
    unit: string,
    step: number,
    min: number,
    max = 100,
  ) => (
    <NumberStepper
      inline
      label={label}
      value={form[key]}
      step={step}
      min={min}
      max={max}
      format={(v) => `${trim(v)} ${unit}`}
      onChange={(v) => set({ [key]: v })}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen
        options={{
          title: exercise ? 'Edit exercise' : 'New exercise',
          headerRight: () => null,
        }}
      />
      <ScreenScroll withBottomBar gap={8}>
        <Section card>
          <View style={{ gap: t.space[4], paddingVertical: t.space[4] }}>
            <TextField
              label="Name"
              maxLength={LIMITS.name}
              value={form.name}
              onChangeText={(name) => set({ name })}
              placeholder="Front squat"
            />
            <TextField
              label="Short name"
              maxLength={LIMITS.name}
              value={form.shortName}
              onChangeText={(shortName) => set({ shortName })}
              placeholder="Front"
            />
            <TextField
              label="Abbreviation"
              value={form.abbr}
              onChangeText={(v) => set({ abbr: v.toUpperCase().slice(0, 3) })}
              placeholder="FS"
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        </Section>

        <Section label="Type" card>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], paddingVertical: t.space[4] }}
          >
            {KINDS.map((k) => (
              <KindChip
                key={k.kind}
                label={k.label}
                selected={form.kind === k.kind}
                disabled={builtIn}
                onPress={() => set({ kind: k.kind })}
              />
            ))}
          </View>
        </Section>

        <Section
          label="Equipment"
          footer="Used to filter the library and to check a program against your gym."
          card
        >
          <ChipGroup
            values={EQUIPMENT}
            labels={EQUIPMENT_LABELS}
            selected={form.equipment}
            onToggle={(v) => set({ equipment: toggle(form.equipment, v) })}
          />
        </Section>

        <Section label="Main muscles" card>
          <ChipGroup
            values={MUSCLES}
            labels={MUSCLE_LABELS}
            selected={form.muscles}
            onToggle={(v) => set({ muscles: toggle(form.muscles, v) })}
          />
        </Section>
        <Section label="Also works" card>
          <ChipGroup
            values={MUSCLES}
            labels={MUSCLE_LABELS}
            selected={form.secondary}
            onToggle={(v) => set({ secondary: toggle(form.secondary, v) })}
          />
        </Section>

        <Section card>
          <ListRow
            title="Held for time"
            subtitle="Sets count seconds, not reps"
            accessory="switch"
            switchValue={form.timed}
            onSwitch={(timed) => set({ timed })}
          />
        </Section>

        <Section
          label={form.kind === 'bodyweight' ? 'Added weight' : 'Progression'}
          footer={
            form.kind === 'bodyweight'
              ? 'Weight added after a good session, for example on a dip belt. 0 keeps it bodyweight.'
              : undefined
          }
          card
        >
          {weightRow(
            form.kind === 'bodyweight' ? 'Added per session (kg)' : 'Increase per session (kg)',
            'incKg',
            'kg',
            0.25,
            0,
          )}
          {weightRow(
            form.kind === 'bodyweight' ? 'Added per session (lb)' : 'Increase per session (lb)',
            'incLb',
            'lb',
            0.25,
            0,
          )}
          {weighted ? weightRow('Weight step (kg)', 'stepKg', 'kg', 0.5, 0.5) : null}
          {weighted ? weightRow('Weight step (lb)', 'stepLb', 'lb', 0.5, 0.5) : null}
        </Section>

        {form.kind === 'barbell' ? (
          <Section label="Bar" card>
            <ListRow
              title="Different bar"
              subtitle="For an EZ bar or a lighter bar than your gym's"
              accessory="switch"
              switchValue={form.ownBar}
              onSwitch={(ownBar) => set({ ownBar })}
            />
            {form.ownBar ? weightRow('Bar weight (kg)', 'barKg', 'kg', 0.5, 1, 50) : null}
            {form.ownBar ? weightRow('Bar weight (lb)', 'barLb', 'lb', 0.5, 1, 110) : null}
          </Section>
        ) : null}

        <Section label="Technique" card>
          <View style={{ gap: t.space[4], paddingVertical: t.space[4] }}>
            {builtIn ? (
              <>
                {form.description ? <Locked label="Description">{form.description}</Locked> : null}
                {form.good ? <Locked label="Good form">{form.good}</Locked> : null}
                {form.bad ? <Locked label="Bad form">{form.bad}</Locked> : null}
                {form.video ? <Locked label="Technique video">{form.video}</Locked> : null}
                <Text variant="callout" color="textMuted">
                  The description, form tips and links of a built-in exercise come with the app and are
                  updated with it. Make a custom exercise to write your own.
                </Text>
              </>
            ) : (
              <>
                <TextField
                  label="Description"
                  maxLength={LIMITS.description}
                  value={form.description}
                  onChangeText={(description) => set({ description })}
                  multiline
                />
                <TextField
                  label="Good form"
                  value={form.good}
                  onChangeText={(good) => set({ good })}
                  multiline
                  placeholder={`One tip per line, up to ${LIMITS.tips}`}
                />
                <TextField
                  label="Bad form"
                  value={form.bad}
                  onChangeText={(bad) => set({ bad })}
                  multiline
                  placeholder={`One tip per line, up to ${LIMITS.tips}`}
                />
                <TextField
                  label="Technique video"
                  value={form.video}
                  onChangeText={(video) => set({ video })}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                />
                {videoProblem ? (
                  <Text variant="callout" color="danger">
                    {videoProblem}
                  </Text>
                ) : null}
                <TextField
                  label="Link"
                  value={form.url}
                  onChangeText={(url) => set({ url })}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://"
                />
                {urlProblem ? (
                  <Text variant="callout" color="danger">
                    {urlProblem}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </Section>

        {exercise?.custom ? <Button title="Delete exercise" variant="destructive" onPress={remove} /> : null}
      </ScreenScroll>
      <BottomBar>
        <Button title="Save" size="lg" disabled={!valid} onPress={save} />
      </BottomBar>
    </View>
  );
}
