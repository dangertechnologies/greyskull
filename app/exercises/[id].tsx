import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import type { Exercise, Kind } from '../../src/domain';
import { trim } from '../../src/domain';
import { customId } from '../../src/exerciseId';
import { goBackOr } from '../../src/navigation';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { EmptyState } from '../../src/ui/EmptyState';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

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

export default function ExerciseEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const exercises = useStore((s) => s.exercises);
  const upsertExercise = useStore((s) => s.upsertExercise);
  const deleteExercise = useStore((s) => s.deleteExercise);
  const existing = isNew ? undefined : exercises[id];
  const t = useTheme();

  const [name, setName] = useState(existing?.name ?? '');
  const [shortName, setShortName] = useState(existing?.shortName ?? '');
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'barbell');
  const [incKg, setIncKg] = useState(existing?.increment.kg ?? 2.5);
  const [incLb, setIncLb] = useState(existing?.increment.lb ?? 5);
  const [stepKg, setStepKg] = useState(existing?.step?.kg ?? 2);
  const [stepLb, setStepLb] = useState(existing?.step?.lb ?? 5);
  const [abbr, setAbbr] = useState(existing?.abbr ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [good, setGood] = useState((existing?.goodForm ?? []).join('\n'));
  const [bad, setBad] = useState((existing?.badForm ?? []).join('\n'));
  const [url, setUrl] = useState(existing?.url ?? '');
  const [video, setVideo] = useState(existing?.video ?? '');

  if (!isNew && !existing) {
    return (
      <ScreenScroll>
        <EmptyState
          icon="lift"
          title="Exercise not found"
          body="It may have been deleted. Your history keeps its sets."
          action={{ title: 'All exercises', onPress: () => router.replace('/exercises') }}
        />
      </ScreenScroll>
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
      abbr: abbr.trim().slice(0, 3).toUpperCase() || undefined,
      kind,
      increment: kind === 'bodyweight' ? { kg: 0, lb: 0 } : { kg: incKg, lb: incLb },
      step: kind === 'dumbbell' || kind === 'machine' ? { kg: stepKg, lb: stepLb } : undefined,
      description: description.trim() || undefined,
      goodForm: lines(good),
      badForm: lines(bad),
      url: url.trim() || undefined,
      video: video.trim() || undefined,
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
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: isNew ? 'New exercise' : existing?.shortName }} />
      <ScreenScroll withBottomBar gap={8}>
        <Text variant="title" accessibilityRole="header">
          {isNew ? 'New exercise' : 'Edit exercise'}
        </Text>

        <Section label="Name">
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Front squat" />
          <TextField label="Short name" value={shortName} onChangeText={setShortName} placeholder="Front" />
          <TextField
            label="Abbreviation"
            value={abbr}
            onChangeText={(v) => setAbbr(v.toUpperCase().slice(0, 3))}
            placeholder="FS"
            autoCapitalize="characters"
            maxLength={3}
          />
        </Section>

        <Section label="Type">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
            {KINDS.map((k) => (
              <Chip
                key={k.kind}
                label={k.label}
                selected={kind === k.kind}
                onPress={() => !locked && setKind(k.kind)}
              />
            ))}
          </View>
        </Section>

        {kind !== 'bodyweight' ? (
          <Section label="Progression">
            <View style={{ gap: t.space[8] }}>
              <NumberStepper
                label="Increase per session (kg)"
                value={incKg}
                step={0.25}
                min={0}
                format={(v) => `${trim(v)} kg`}
                onChange={setIncKg}
              />
              <NumberStepper
                label="Increase per session (lb)"
                value={incLb}
                step={0.25}
                min={0}
                format={(v) => `${trim(v)} lb`}
                onChange={setIncLb}
              />
              {kind === 'dumbbell' || kind === 'machine' ? (
                <>
                  <NumberStepper
                    label="Weight step (kg)"
                    value={stepKg}
                    step={0.5}
                    min={0.5}
                    format={(v) => `${trim(v)} kg`}
                    onChange={setStepKg}
                  />
                  <NumberStepper
                    label="Weight step (lb)"
                    value={stepLb}
                    step={0.5}
                    min={0.5}
                    format={(v) => `${trim(v)} lb`}
                    onChange={setStepLb}
                  />
                </>
              ) : null}
            </View>
          </Section>
        ) : null}

        <Section label="Technique">
          <TextField label="Description" value={description} onChangeText={setDescription} multiline />
          <TextField
            label="Good form"
            value={good}
            onChangeText={setGood}
            multiline
            placeholder="One tip per line"
          />
          <TextField
            label="Bad form"
            value={bad}
            onChangeText={setBad}
            multiline
            placeholder="One tip per line"
          />
          <TextField
            label="Technique video"
            value={video}
            onChangeText={setVideo}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <TextField
            label="Link"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
        </Section>

        {existing?.custom ? <Button title="Delete exercise" variant="destructive" onPress={remove} /> : null}
      </ScreenScroll>
      <BottomBar>
        <Button title="Save" size="lg" disabled={!valid} onPress={save} />
      </BottomBar>
    </View>
  );
}
