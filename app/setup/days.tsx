import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DaysEditor } from '../../src/components/DaysEditor';
import { useTheme } from '../../src/design/theme';
import type { Program } from '../../src/domain';
import { validateProgram } from '../../src/domain';
import { useProgramById } from '../../src/hooks/useProgramById';
import { goBackOr, goHome } from '../../src/navigation';
import { useSetup } from '../../src/setup/SetupContext';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';

/**
 * Edit the days of a program. `?edit=1` edits the saved program (Plan tab); `?setup=1` edits the draft from
 * onboarding or Change plan and returns to the review screen.
 */
export default function Days() {
  const { edit, program: programParam } = useLocalSearchParams<{ edit?: string; program?: string }>();
  const editing = edit === '1';
  const setup = useSetup();
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const stored = useProgramById(programParam);
  const updateProgram = useStore((s) => s.updateProgram);
  const [program, setLocal] = useState<Program | null>(editing ? (stored ?? null) : setup.draft.program);

  if (!program) return <Redirect href={editing ? '/' : '/setup/plan'} />;
  const errors = validateProgram(program, exercises);

  const done = () => {
    setup.update({ program });
    goBackOr('/');
  };
  const save = () => {
    const commit = () => {
      try {
        if (!stored) throw new Error('The program no longer exists');
        updateProgram(stored.id, program);
        goHome();
      } catch (e) {
        Alert.alert('Cannot save', e instanceof Error ? e.message : String(e));
      }
    };
    const open = useStore.getState().draft;
    if (!open || open.programId !== stored?.id) return commit();
    Alert.alert(
      'Discard the workout in progress?',
      'Saving a new program ends the current workout without logging it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard and save', style: 'destructive', onPress: commit },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: editing ? 'Edit program' : 'Your days' }} />
      <ScreenScroll withBottomBar gap={6}>
        {editing ? <Text color="textMuted">Your history and current weights are kept.</Text> : null}
        <View style={{ height: t.space[4] }} />
        <DaysEditor program={program} onChange={setLocal} />
      </ScreenScroll>
      <BottomBar>
        {editing ? (
          <Button title="Save" size="lg" disabled={errors.length > 0} onPress={save} />
        ) : (
          <Button title="Done" size="lg" disabled={errors.length > 0} onPress={done} />
        )}
      </BottomBar>
    </View>
  );
}
