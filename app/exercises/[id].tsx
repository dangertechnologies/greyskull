import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ExerciseIcon } from '../../src/components/ExerciseIcon';
import { Screen } from '../../src/components/Screen';
import { Stepper } from '../../src/components/Stepper';
import type { Exercise, Kind } from '../../src/domain';
import { trim } from '../../src/domain';
import { customId } from '../../src/exerciseId';
import { ICONS } from '../../src/icons';
import { goBackOr } from '../../src/navigation';
import { useStore } from '../../src/store';
import { colors, type } from '../../src/theme';

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'barbell', label: 'Barbell' },
  { kind: 'dumbbell', label: 'Dumbbell' },
  { kind: 'machine', label: 'Machine' },
  { kind: 'bodyweight', label: 'Bodyweight' },
];

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.label}>{label}</Text>
      {children}
    </View>
  );
}

export default function ExerciseEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const exercises = useStore((s) => s.exercises);
  const upsertExercise = useStore((s) => s.upsertExercise);
  const deleteExercise = useStore((s) => s.deleteExercise);
  const existing = isNew ? undefined : exercises[id];

  const [name, setName] = useState(existing?.name ?? '');
  const [shortName, setShortName] = useState(existing?.shortName ?? '');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'barbell');
  const [incKg, setIncKg] = useState(existing?.increment.kg ?? 2.5);
  const [incLb, setIncLb] = useState(existing?.increment.lb ?? 5);
  const [stepKg, setStepKg] = useState(existing?.step?.kg ?? 2);
  const [stepLb, setStepLb] = useState(existing?.step?.lb ?? 5);
  const [icon, setIcon] = useState(existing?.icon ?? 'muscle');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [good, setGood] = useState((existing?.goodForm ?? []).join('\n'));
  const [bad, setBad] = useState((existing?.badForm ?? []).join('\n'));
  const [url, setUrl] = useState(existing?.url ?? '');

  if (!isNew && !existing) {
    return (
      <Screen>
        <Text style={type.body}>This exercise no longer exists.</Text>
      </Screen>
    );
  }

  const locked = existing && !existing.custom; // built-ins keep their kind
  const valid = name.trim().length > 0;

  const save = () => {
    const trimmed = name.trim();
    const saved: Exercise = {
      ...existing,
      id: existing?.id ?? customId(trimmed, exercises),
      name: trimmed,
      shortName: shortName.trim() || trimmed.split(/\s+/)[0],
      icon,
      kind,
      increment: kind === 'bodyweight' ? { kg: 0, lb: 0 } : { kg: incKg, lb: incLb },
      step: kind === 'dumbbell' || kind === 'machine' ? { kg: stepKg, lb: stepLb } : undefined,
      description: description.trim() || undefined,
      goodForm: lines(good),
      badForm: lines(bad),
      url: url.trim() || undefined,
      custom: existing ? existing.custom : true,
    };
    upsertExercise(saved);
    goBackOr('/exercises');
  };

  const remove = () => {
    const days = deleteExercise(id);
    if (days.length > 0) {
      Alert.alert(
        'Still in your program',
        `Remove it from ${days.join(', ')} first (Settings → Edit program).`,
      );
    } else {
      goBackOr('/exercises');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New exercise' : existing?.shortName }} />
      <Text style={type.title} accessibilityRole="header">
        {isNew ? 'New exercise' : 'Edit exercise'}
      </Text>

      <Field label="Name">
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Front squat"
          placeholderTextColor={colors.dim}
        />
      </Field>
      <Field label="Short name">
        <TextInput
          accessibilityLabel="Short name"
          value={shortName}
          onChangeText={setShortName}
          style={styles.input}
          placeholder="Front"
          placeholderTextColor={colors.dim}
        />
      </Field>

      <Field label="Type">
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Pressable
              key={k.kind}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k.kind, disabled: !!locked }}
              disabled={!!locked}
              onPress={() => setKind(k.kind)}
              style={[
                styles.chip,
                kind === k.kind && styles.chipOn,
                locked && kind !== k.kind && { opacity: 0.3 },
              ]}
            >
              <Text style={[styles.chipText, kind === k.kind && { color: '#000' }]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      {kind !== 'bodyweight' ? (
        <>
          <Stepper
            label="Increase per session (kg)"
            value={incKg}
            step={0.25}
            min={0}
            format={(v) => `${trim(v)} kg`}
            onChange={setIncKg}
          />
          <Stepper
            label="Increase per session (lb)"
            value={incLb}
            step={0.25}
            min={0}
            format={(v) => `${trim(v)} lb`}
            onChange={setIncLb}
          />
        </>
      ) : null}
      {kind === 'dumbbell' || kind === 'machine' ? (
        <>
          <Stepper
            label="Weight step (kg)"
            value={stepKg}
            step={0.5}
            min={0.5}
            format={(v) => `${trim(v)} kg`}
            onChange={setStepKg}
          />
          <Stepper
            label="Weight step (lb)"
            value={stepLb}
            step={0.5}
            min={0.5}
            format={(v) => `${trim(v)} lb`}
            onChange={setStepLb}
          />
        </>
      ) : null}

      <Field label="Icon">
        <View style={styles.chips}>
          {Object.keys(ICONS).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={`Icon ${key}`}
              accessibilityState={{ selected: icon === key }}
              onPress={() => setIcon(key)}
              style={[styles.iconCell, icon === key && styles.iconOn]}
            >
              <ExerciseIcon icon={key} size={28} />
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Description">
        <TextInput
          accessibilityLabel="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={[styles.input, styles.multi]}
        />
      </Field>
      <Field label="Good form (one per line)">
        <TextInput
          accessibilityLabel="Good form"
          value={good}
          onChangeText={setGood}
          multiline
          style={[styles.input, styles.multi]}
        />
      </Field>
      <Field label="Bad form (one per line)">
        <TextInput
          accessibilityLabel="Bad form"
          value={bad}
          onChangeText={setBad}
          multiline
          style={[styles.input, styles.multi]}
        />
      </Field>
      <Field label="Link">
        <TextInput
          accessibilityLabel="Link"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
          placeholder="https://"
          placeholderTextColor={colors.dim}
        />
      </Field>

      <Button title="Save" disabled={!valid} onPress={save} />
      {existing?.custom ? <Button title="Delete" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 4,
    color: colors.text,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 16,
    fontWeight: '300',
  },
  multi: { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 20,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '300' },
  iconCell: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.faint,
    borderRadius: 8,
  },
  iconOn: { borderColor: colors.text, backgroundColor: colors.faint },
});
