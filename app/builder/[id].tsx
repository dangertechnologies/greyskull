import { router, Stack, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { DaysEditor } from '../../src/components/DaysEditor';
import { RulesEditor } from '../../src/components/RulesEditor';
import { getPlan } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import type { CustomPlan, Program } from '../../src/domain';
import { blankProgram, copyProgram, validateProgram } from '../../src/domain';
import { useProgramById } from '../../src/hooks/useProgramById';
import { copyPlan, newPlanId, sharePlan } from '../../src/planShare';
import { uniqueProgramName } from '../../src/programPicker';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { Section } from '../../src/ui/Section';
import { useSnackbar } from '../../src/ui/Snackbar';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

interface Seed {
  planId: string;
  name: string;
  summary: string;
  program: Program;
}

const NOT_FOUND = (
  <ScreenScroll gap={6}>
    <Stack.Screen options={{ title: 'Program' }} />
    <Text variant="headline" accessibilityRole="header">
      Program not found
    </Text>
    <Text color="textMuted">It may have been deleted.</Text>
    <Button title="Back" variant="secondary" onPress={() => router.replace('/builder')} />
  </ScreenScroll>
);

/**
 * `/builder/new` starts a program (blank, or a copy of `?program=<running program id>` or `?plan=<built-in
 * plan id>`); `/builder/<id>` edits the saved custom program with that id.
 */
export default function BuilderRoute() {
  const {
    id,
    program: programParam,
    plan: planParam,
  } = useLocalSearchParams<{
    id: string;
    program?: string;
    plan?: string;
  }>();
  const customPlans = useStore((s) => s.customPlans);
  const source = useProgramById(programParam);
  const builtIn = planParam ? getPlan(planParam) : undefined;
  const stored = id === 'new' ? undefined : customPlans.find((p) => p.id === id);
  const seed = useRef<Seed | null>(null);

  if (id !== 'new' && !stored) return NOT_FOUND;
  if ((programParam && !source) || (planParam && !builtIn)) return NOT_FOUND;
  if (!seed.current) {
    const taken = customPlans.map((p) => p.name);
    const from = source ?? builtIn?.program;
    const base = source?.name ?? builtIn?.name;
    seed.current = stored
      ? { planId: stored.id, name: stored.name, summary: stored.summary ?? '', program: stored.program }
      : {
          planId: newPlanId(customPlans.map((p) => p.id)),
          name: uniqueProgramName(base ? `${base} copy` : 'My program', taken),
          summary: '',
          program: from ? copyProgram(from) : blankProgram(),
        };
  }
  return <Builder seed={seed.current} isNew={id === 'new'} />;
}

const snapshot = (name: string, summary: string, program: Program): string =>
  JSON.stringify({ name: name.trim(), summary: summary.trim(), program });

function Builder({ seed, isNew }: { seed: Seed; isNew: boolean }) {
  const t = useTheme();
  const navigation = useNavigation();
  const snackbar = useSnackbar();
  const exercises = useStore((s) => s.exercises);
  const stored = useStore((s) => s.customPlans.find((p) => p.id === seed.planId));
  const [name, setName] = useState(seed.name);
  const [summary, setSummary] = useState(seed.summary);
  const [program, setProgram] = useState(seed.program);
  const leaving = useRef(false);

  const errors = validateProgram(program, exercises);
  const now = snapshot(name, summary, program);
  const saved = stored ? snapshot(stored.name, stored.summary ?? '', stored.program) : null;
  const dirty = now !== saved;
  // A new program with nothing entered yet is not worth asking about.
  const changed = saved === null ? now !== snapshot(seed.name, seed.summary, seed.program) : dirty;
  const canSave = name.trim().length > 0 && errors.length === 0;

  usePreventRemove(changed && !leaving.current, ({ data }) =>
    Alert.alert('Discard your changes?', 'This program has changes you have not saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard changes',
        style: 'destructive',
        onPress: () => {
          leaving.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]),
  );

  const plan = (): CustomPlan => ({
    id: seed.planId,
    name: name.trim(),
    ...(summary.trim() ? { summary: summary.trim() } : {}),
    program,
  });
  const save = () => {
    try {
      useStore.getState().saveCustomPlan(plan());
      snackbar.show({ message: 'Program saved' });
    } catch (e) {
      Alert.alert('Cannot save', e instanceof Error ? e.message : String(e));
    }
  };
  const share = async () => {
    if (!stored) return;
    try {
      if (!(await sharePlan(stored, exercises)))
        Alert.alert('Sharing is not available', 'Use "Copy as text" and send it yourself.');
    } catch (e) {
      Alert.alert('Cannot share', e instanceof Error ? e.message : String(e));
    }
  };
  const copy = async () => {
    if (!stored) return;
    try {
      await copyPlan(stored, exercises);
      snackbar.show({ message: 'Copied. Paste it into Import a shared program.' });
    } catch (e) {
      Alert.alert('Cannot copy', e instanceof Error ? e.message : String(e));
    }
  };
  const remove = () =>
    Alert.alert(
      `Delete ${stored?.name ?? 'this program'}?`,
      'Programs you already started from it keep running.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete program',
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            useStore.getState().deleteCustomPlan(seed.planId);
            router.replace('/builder');
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: isNew && !stored ? 'New program' : 'Edit program' }} />
      <ScreenScroll withBottomBar gap={10}>
        <View style={{ gap: t.space[4] }}>
          <TextField label="Program name" value={name} onChangeText={setName} maxLength={100} />
          <TextField label="Summary (optional)" value={summary} onChangeText={setSummary} maxLength={300} />
        </View>
        <Section label="Sessions a week">
          <NumberStepper
            label="Training days per week"
            value={program.sessionsPerWeek}
            min={1}
            max={7}
            step={1}
            format={String}
            onChange={(sessionsPerWeek) => setProgram({ ...program, sessionsPerWeek })}
          />
        </Section>
        <Section label="Days">
          <DaysEditor program={program} onChange={setProgram} errors={errors} />
        </Section>
        <Section label="Rules">
          <RulesEditor card rules={program.rules} onChange={(rules) => setProgram({ ...program, rules })} />
        </Section>
        {stored ? (
          <Section
            label="Share and start"
            footer={
              dirty ? 'Save your changes first: sharing and starting use the saved program.' : undefined
            }
          >
            <View style={{ gap: t.space[2] }}>
              <Button
                title="Start this program"
                variant="secondary"
                disabled={dirty}
                onPress={() => router.push(`/setup/plan?add=1&pick=${seed.planId}`)}
              />
              <Button title="Share" variant="secondary" disabled={dirty} onPress={() => void share()} />
              <Button title="Copy as text" variant="secondary" disabled={dirty} onPress={() => void copy()} />
              <Button title="Delete program" variant="destructive" onPress={remove} />
            </View>
          </Section>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button
          title={stored && !dirty ? 'Saved' : 'Save'}
          size="lg"
          disabled={!canSave || (stored !== undefined && !dirty)}
          onPress={save}
        />
      </BottomBar>
    </View>
  );
}
