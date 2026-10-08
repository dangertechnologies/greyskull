import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { Screen } from '../../src/components/Screen';
import type { Program } from '../../src/domain';
import {
  addAlternatingSlot,
  addDay,
  addSlot,
  moveSlot,
  nextScheme,
  removeDay,
  removeSlot,
  renameDay,
  setSlotScheme,
  validateProgram,
} from '../../src/domain';
import { nameOf } from '../../src/format';
import { goHome } from '../../src/navigation';
import { useSetup } from '../../src/setup/SetupContext';
import { useStore } from '../../src/store';
import { colors, type } from '../../src/theme';

type Picking = { day: number; mode: 'single' | 'pair'; first?: string } | null;

function IconButton({
  name,
  label,
  onPress,
  disabled,
}: {
  name: 'chevron-up' | 'chevron-down' | 'close';
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={[styles.icon, disabled && { opacity: 0.25 }]}
    >
      <Ionicons name={name} size={22} color={colors.text} />
    </Pressable>
  );
}

export default function Days() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const setup = useSetup();
  const exercises = useStore((s) => s.exercises);
  const stored = useStore((s) => s.program);
  const setProgram = useStore((s) => s.setProgram);
  const [program, setLocal] = useState<Program | null>(editing ? stored : setup.draft.program);
  const [picking, setPicking] = useState<Picking>(null);

  if (!program) return <Redirect href={editing ? '/' : '/setup/template'} />;
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

  const next = () => {
    setup.update({ program });
    router.push('/setup/weights');
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

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">
        {editing ? 'Edit program' : 'Your days'}
      </Text>
      {editing ? <Text style={type.small}>Your history and current weights are kept.</Text> : null}

      {program.days.map((day, d) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: days are edited by position and have no id
        <View key={d} style={styles.card}>
          <View style={styles.dayHead}>
            <TextInput
              accessibilityLabel={`Name of day ${d + 1}`}
              value={day.name}
              onChangeText={(name) => change(renameDay(program, d, name))}
              style={styles.dayName}
            />
            <IconButton
              name="close"
              label={`Remove ${day.name}`}
              onPress={() => change(removeDay(program, d))}
            />
          </View>
          {day.slots.map((slot, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are edited by position and have no id
            <View key={i} style={styles.slot}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>
                  {typeof slot.exercise === 'string'
                    ? nameOf(exercises, slot.exercise)
                    : `${nameOf(exercises, slot.exercise[0], true)} / ${nameOf(exercises, slot.exercise[1], true)}`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Scheme ${slot.scheme}, tap to change`}
                onPress={() => change(setSlotScheme(program, d, i, nextScheme(slot.scheme)))}
                style={styles.chip}
              >
                <Text style={type.small}>{slot.scheme}</Text>
              </Pressable>
              <IconButton
                name="chevron-up"
                label="Move up"
                disabled={i === 0}
                onPress={() => change(moveSlot(program, d, i, -1))}
              />
              <IconButton
                name="chevron-down"
                label="Move down"
                disabled={i === day.slots.length - 1}
                onPress={() => change(moveSlot(program, d, i, 1))}
              />
              <IconButton
                name="close"
                label="Remove exercise"
                onPress={() => change(removeSlot(program, d, i))}
              />
            </View>
          ))}
          <View style={styles.addRow}>
            <Button
              title="Add exercise"
              variant="link"
              onPress={() => setPicking({ day: d, mode: 'single' })}
            />
            <Button
              title="Add alternating pair"
              variant="link"
              onPress={() => setPicking({ day: d, mode: 'pair' })}
            />
          </View>
        </View>
      ))}

      <Button title="Add day" variant="link" onPress={() => change(addDay(program))} />
      {errors.map((e) => (
        <Text key={e} style={type.error}>
          {e}
        </Text>
      ))}
      {editing ? (
        <Button title="Save" disabled={errors.length > 0} onPress={save} />
      ) : (
        <Button title="Next" disabled={errors.length > 0} onPress={next} />
      )}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 8, padding: 12, gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayName: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '300',
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.faint,
  },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  chip: {
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 28,
    justifyContent: 'center',
  },
  icon: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
