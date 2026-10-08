import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import type { Exercise } from '../../src/domain';
import { exerciseIdsOf } from '../../src/domain';
import { useStore } from '../../src/store';
import { ExerciseBadge } from '../../src/ui/ExerciseBadge';
import { Icon } from '../../src/ui/Icon';
import { IconButton } from '../../src/ui/IconButton';
import { ScreenScroll } from '../../src/ui/layout';
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
        minHeight: 72,
        backgroundColor: pressed ? t.color.border : 'transparent',
      })}
    >
      <ExerciseBadge exercise={exercise} size={40} />
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
  const t = useTheme();
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
      <Stack.Screen
        options={{
          title: 'Exercises',
          headerRight: () => (
            <IconButton icon="add" label="New exercise" onPress={() => router.push('/exercises/new')} />
          ),
        }}
      />
      <Section label="Custom" card>
        {custom.length === 0 ? (
          <Text color="textMuted" style={{ paddingVertical: t.space[4] }}>
            None yet.
          </Text>
        ) : null}
        {custom.map((e) => (
          <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
        ))}
      </Section>
      <Section label="Built-in" card>
        {builtIn.map((e) => (
          <Row key={e.id} exercise={e} inProgram={used.has(e.id)} />
        ))}
      </Section>
    </ScreenScroll>
  );
}
