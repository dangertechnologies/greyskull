import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ExerciseIcon } from '../../src/components/ExerciseIcon';
import { Screen } from '../../src/components/Screen';
import type { Exercise } from '../../src/domain';
import { exerciseIdsOf } from '../../src/domain';
import { useStore } from '../../src/store';
import { colors, type } from '../../src/theme';

function Row({ exercise, inProgram }: { exercise: Exercise; inProgram: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      onPress={() => router.push(`/exercises/${exercise.id}`)}
      style={styles.row}
    >
      <ExerciseIcon icon={exercise.icon} />
      <Text style={[type.body, { flex: 1 }]}>{exercise.name}</Text>
      {inProgram ? <Text style={type.small}>in program</Text> : null}
    </Pressable>
  );
}

export default function Exercises() {
  const exercises = useStore((s) => s.exercises);
  const program = useStore((s) => s.program);
  const used = new Set(program ? exerciseIdsOf(program) : []);
  const all = Object.values(exercises).sort((a, b) => a.name.localeCompare(b.name));
  const builtIn = all.filter((e) => !e.custom);
  const custom = all.filter((e) => e.custom);

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">
        Exercises
      </Text>
      <Button title="New exercise" onPress={() => router.push('/exercises/new')} />
      <Text style={type.label}>Custom</Text>
      <View>
        {custom.length === 0 ? <Text style={type.small}>None yet.</Text> : null}
        {custom.map((e) => (
          <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
        ))}
      </View>
      <Text style={type.label}>Built-in</Text>
      <View>
        {builtIn.map((e) => (
          <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.faint,
  },
});
