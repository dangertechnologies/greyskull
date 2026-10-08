import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { WorkoutRow } from '../src/components/WorkoutRow';
import { useTheme } from '../src/design/theme';
import { useStore } from '../src/store';
import { EmptyState } from '../src/ui/EmptyState';
import { useGutter } from '../src/ui/layout';

/** Every logged workout, newest first (Today only shows the last three). */
export default function History() {
  const sessions = useStore((s) => s.sessions);
  const t = useTheme();
  const gutter = useGutter();
  const data = [...sessions].reverse();
  return (
    <>
      <Stack.Screen options={{ title: 'History' }} />
      {/* View root, as in ScreenScroll: a list as the screen root left the large title blank on iOS. */}
      <View style={{ flex: 1, backgroundColor: t.color.background }}>
        <FlatList
          data={data}
          keyExtractor={(s) => String(s.n)}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: t.space[4],
            paddingBottom: t.space[12],
          }}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={<EmptyState icon="calendar" title="No workouts yet" />}
          // One grouped card, built from the rows so the list stays virtualised.
          ItemSeparatorComponent={() => (
            <View style={{ backgroundColor: t.color.surface, paddingHorizontal: t.space[5] }}>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border }} />
            </View>
          )}
          renderItem={({ item: log, index }) => {
            const r = t.radius.xl;
            return (
              <View
                style={{
                  backgroundColor: t.color.surface,
                  paddingHorizontal: t.space[5],
                  borderTopLeftRadius: index === 0 ? r : 0,
                  borderTopRightRadius: index === 0 ? r : 0,
                  borderBottomLeftRadius: index === data.length - 1 ? r : 0,
                  borderBottomRightRadius: index === data.length - 1 ? r : 0,
                }}
              >
                <WorkoutRow log={log} />
              </View>
            );
          }}
        />
      </View>
    </>
  );
}
