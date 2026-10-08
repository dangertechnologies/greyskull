import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { SchemeSheet } from '../../src/components/SchemeSheet';
import { SlotRow } from '../../src/components/SlotRow';
import { useTheme } from '../../src/design/theme';
import type { Program } from '../../src/domain';
import {
  addAlternatingSlot,
  addDay,
  addSlot,
  moveSlot,
  moveSlotTo,
  removeDay,
  removeSlot,
  renameDay,
  setSlotScheme,
  validateProgram,
} from '../../src/domain';
import { nameOf, schemeLabel } from '../../src/format';
import { goBackOr, goHome } from '../../src/navigation';
import { useSetup } from '../../src/setup/SetupContext';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { IconButton } from '../../src/ui/IconButton';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Monogram } from '../../src/ui/Monogram';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

type Picking = { day: number; mode: 'single' | 'pair'; first?: string } | null;

/**
 * Edit the days of a program. `?edit=1` edits the saved program (Plan tab); `?setup=1` edits the draft from
 * onboarding or Change plan and returns to the review screen.
 */
export default function Days() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const setup = useSetup();
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const stored = useStore((s) => s.program);
  const setProgram = useStore((s) => s.setProgram);
  const [program, setLocal] = useState<Program | null>(editing ? stored : setup.draft.program);
  const [picking, setPicking] = useState<Picking>(null);
  const [schemeFor, setSchemeFor] = useState<{ day: number; slot: number } | null>(null);

  if (!program) return <Redirect href={editing ? '/' : '/setup/plan'} />;
  const errors = validateProgram(program, exercises);
  const change = (next: Program) => setLocal(next);

  const onPick = (id: string) => {
    if (!picking) return;
    if (picking.mode === 'single') {
      change(addSlot(program, picking.day, id));
      setPicking(null);
    } else if (!picking.first) {
      setPicking({ ...picking, first: id });
    } else {
      change(addAlternatingSlot(program, picking.day, picking.first, id));
      setPicking(null);
    }
  };
  const dayIds = picking
    ? program.days[picking.day].slots.flatMap((s) =>
        typeof s.exercise === 'string' ? [s.exercise] : s.exercise,
      )
    : [];

  const done = () => {
    setup.update({ program });
    goBackOr('/');
  };
  const save = () => {
    const commit = () => {
      try {
        setProgram(program);
        goHome();
      } catch (e) {
        Alert.alert('Cannot save', e instanceof Error ? e.message : String(e));
      }
    };
    if (!useStore.getState().draft) return commit();
    Alert.alert(
      'Discard the workout in progress?',
      'Saving a new program ends the current workout without logging it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard and save', style: 'destructive', onPress: commit },
      ],
    );
  };

  const sheetSlot = schemeFor ? program.days[schemeFor.day]?.slots[schemeFor.slot] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: editing ? 'Edit days' : 'Customise days' }} />
      <ScreenScroll withBottomBar gap={6}>
        <Text variant="title" accessibilityRole="header">
          {editing ? 'Edit program' : 'Your days'}
        </Text>
        {editing ? <Text color="textMuted">Your history and current weights are kept.</Text> : null}
        <View style={{ height: t.space[4] }} />

        <View style={{ gap: t.space[6] }}>
          {program.days.map((day, d) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: days are edited by position and have no id
            <Card key={d} style={{ gap: t.space[5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space[2] }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={`Name of day ${d + 1}`}
                    value={day.name}
                    onChangeText={(name) => change(renameDay(program, d, name))}
                  />
                </View>
                <IconButton
                  icon="delete"
                  label={`Remove ${day.name}`}
                  tone="danger"
                  onPress={() => change(removeDay(program, d))}
                />
              </View>

              {day.slots.map((slot, i) => {
                const ids = typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise;
                const first = exercises[ids[0]];
                return (
                  <SlotRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: slots are edited by position and have no id
                    key={i}
                    index={i}
                    count={day.slots.length}
                    handleLabel={`Reorder ${ids.map((id) => nameOf(exercises, id, ids.length > 1)).join(' / ')}`}
                    onDrop={(to) => change(moveSlotTo(program, d, i, to))}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.space[3],
                        paddingRight: 36,
                      }}
                    >
                      {first ? <Monogram exercise={first} size={40} /> : null}
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {ids.map((id) => nameOf(exercises, id, ids.length > 1)).join(' / ')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1] }}>
                      <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <Button
                          title={schemeLabel(slot.scheme)}
                          variant="secondary"
                          accessibilityLabel={`Scheme ${slot.scheme}, tap to change`}
                          onPress={() => setSchemeFor({ day: d, slot: i })}
                        />
                      </View>
                      <IconButton
                        icon="up"
                        label="Move up"
                        disabled={i === 0}
                        onPress={() => change(moveSlot(program, d, i, -1))}
                      />
                      <IconButton
                        icon="down"
                        label="Move down"
                        disabled={i === day.slots.length - 1}
                        onPress={() => change(moveSlot(program, d, i, 1))}
                      />
                      <IconButton
                        icon="close"
                        label="Remove exercise"
                        tone="danger"
                        onPress={() => change(removeSlot(program, d, i))}
                      />
                    </View>
                  </SlotRow>
                );
              })}

              <View style={{ gap: t.space[2] }}>
                <Button
                  title="Add exercise"
                  variant="secondary"
                  onPress={() => setPicking({ day: d, mode: 'single' })}
                />
                <Button
                  title="Add alternating pair"
                  variant="plain"
                  onPress={() => setPicking({ day: d, mode: 'pair' })}
                />
              </View>
            </Card>
          ))}
        </View>

        <View style={{ height: t.space[2] }} />
        <Button title="Add day" variant="secondary" onPress={() => change(addDay(program))} />
        {errors.map((e) => (
          <Text key={e} variant="callout" color="danger">
            {e}
          </Text>
        ))}
      </ScreenScroll>
      <BottomBar>
        {editing ? (
          <Button title="Save" size="lg" disabled={errors.length > 0} onPress={save} />
        ) : (
          <Button title="Done" size="lg" disabled={errors.length > 0} onPress={done} />
        )}
      </BottomBar>

      <ExercisePicker
        visible={picking !== null}
        title={
          picking?.mode === 'pair'
            ? picking.first
              ? 'Alternate with…'
              : 'First exercise of the pair'
            : 'Choose an exercise'
        }
        exercises={exercises}
        exclude={picking?.first ? [...dayIds, picking.first] : dayIds}
        onPick={onPick}
        onClose={() => setPicking(null)}
      />

      {schemeFor && sheetSlot ? (
        <SchemeSheet
          scheme={sheetSlot.scheme}
          onClose={() => setSchemeFor(null)}
          onSave={(scheme) => {
            change(setSlotScheme(program, schemeFor.day, schemeFor.slot, scheme));
            setSchemeFor(null);
          }}
        />
      ) : null}
    </View>
  );
}
