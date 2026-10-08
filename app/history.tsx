import { router, Stack } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useTheme } from '../src/design/theme';
import { formatDate, summarize } from '../src/format';
import { useStore } from '../src/store';
import { EmptyState } from '../src/ui/EmptyState';
import { useGutter } from '../src/ui/layout';
import { Text } from '../src/ui/Text';

/** Every logged workout, newest first (Today only shows the last three). */
export default function History() {
  const sessions = useStore((s) => s.sessions);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const t = useTheme();
  const gutter = useGutter();
  const data = [...sessions].reverse();
  return (
    <>
      <Stack.Screen options={{ title: 'History' }} />
      <FlatList
        data={data}
        keyExtractor={(s) => String(s.n)}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: t.space[4],
          paddingBottom: t.space[12],
        }}
        ListEmptyComponent={<EmptyState icon="calendar" title="No workouts yet" />}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: t.color.border, marginVertical: t.space[1] }} />
        )}
        renderItem={({ item: log }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Session ${log.n + 1}, ${log.skipped ? 'skipped' : 'edit'}`}
            onPress={() => !log.skipped && router.push(`/session/edit/${log.n}`)}
            style={{ paddingVertical: t.space[4], gap: t.space[1] }}
          >
            <Text variant="bodyStrong">{`#${log.n + 1}${log.dayName ? ` · ${log.dayName}` : ' · Imported workout'}`}</Text>
            <Text variant="caption" color="textMuted">
              {log.finishedAt ? formatDate(log.finishedAt) : ''}
            </Text>
            <Text variant="callout" color="textMuted">
              {summarize(log, exercises, unit)}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}
