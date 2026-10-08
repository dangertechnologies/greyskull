import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import type { Exercise } from '../../src/domain';
import { exerciseIdsOf } from '../../src/domain';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { ScreenScroll } from '../../src/ui/layout';
import { Monogram } from '../../src/ui/Monogram';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

function Row({ exercise, inProgram }: { exercise: Exercise; inProgram: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      onPress={() => router.push(`/exercises/${exercise.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[4],
        minHeight: 64,
        backgroundColor: pressed ? t.color.surface : 'transparent',
      })}
    >
      <Monogram exercise={exercise} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{exercise.name}</Text>
        {inProgram ? (
          <Text variant="caption" color="textMuted">
            in program
          </Text>
        ) : null}
      </View>
      <Icon name="chevron" size={16} color="textMuted" />
    </Pressable>
  );
}

export default function Exercises() {
  const exercises = useStore((s) => s.exercises);
  const program = useStore((s) => s.program);
  const used = new Set(program ? exerciseIdsOf(program) : []);
  const all = Object.values(exercises)
    .filter((e) => !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
  const builtIn = all.filter((e) => !e.custom);
  const custom = all.filter((e) => e.custom);

  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: 'Exercises' }} />
      <Text variant="title" accessibilityRole="header">
        Exercises
      </Text>
      <Button title="New exercise" icon="add" onPress={() => router.push('/exercises/new')} />
      <Section label="Custom">
        {custom.length === 0 ? <Text color="textMuted">None yet.</Text> : null}
        <View>
          {custom.map((e) => (
            <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
          ))}
        </View>
      </Section>
      <Section label="Built-in">
        <View>
          {builtIn.map((e) => (
            <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
          ))}
        </View>
      </Section>
    </ScreenScroll>
  );
}
