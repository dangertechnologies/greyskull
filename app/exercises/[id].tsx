import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ExerciseDetail } from '../../src/components/ExerciseDetail';
import { ExerciseEditor } from '../../src/components/ExerciseEditor';
import { own } from '../../src/domain';
import { useStore } from '../../src/store';
import { EmptyState } from '../../src/ui/EmptyState';
import { IconButton } from '../../src/ui/IconButton';
import { ScreenScroll } from '../../src/ui/layout';

/**
 * `/exercises/<id>` shows an exercise; `/exercises/<id>?edit=1` edits it; `/exercises/new` creates a custom one.
 */
export default function ExerciseScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const exercise = useStore((s) => own(s.exercises, id));
  if (id === 'new') return <ExerciseEditor />;
  if (!exercise) {
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
  if (edit && edit !== '0' && edit !== 'false') return <ExerciseEditor key={id} exercise={exercise} />;
  return (
    <ScreenScroll gap={8}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton
              icon="edit"
              label={`Edit ${exercise.name}`}
              onPress={() => router.push({ pathname: '/exercises/[id]', params: { id, edit: '1' } })}
            />
          ),
        }}
      />
      <ExerciseDetail exercise={exercise} />
    </ScreenScroll>
  );
}
