import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseRow, type RowPosition } from '../../src/components/ExerciseRow';
import { FilterSheet } from '../../src/components/FilterSheet';
import { useTheme } from '../../src/design/theme';
import type { Equipment, Exercise, Muscle, Pattern } from '../../src/domain';
import { exerciseIdsOf } from '../../src/domain';
import {
  EMPTY_FILTERS,
  EQUIPMENT_LABELS,
  type ExerciseFilters,
  filterCount,
  filterExercises,
  MUSCLE_LABELS,
  PATTERN_LABELS,
} from '../../src/exerciseFilter';
import { useStore } from '../../src/store';
import { Chip } from '../../src/ui/Chip';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/Icon';
import { IconButton } from '../../src/ui/IconButton';
import { useGutter } from '../../src/ui/layout';
import { Text } from '../../src/ui/Text';

type Sheet = 'equipment' | 'muscles' | 'patterns' | null;

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const EQUIPMENT_OPTIONS = options(EQUIPMENT_LABELS);
const MUSCLE_OPTIONS = options(MUSCLE_LABELS);
const PATTERN_OPTIONS = options(PATTERN_LABELS);

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

/** The search text, applied 150 ms after the last keystroke so a long list is not redrawn on every letter. */
function useDebounced<T>(value: T, ms = 150): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
}

const open = (id: string) => router.push(`/exercises/${id}`);
const position = (i: number, n: number): RowPosition =>
  n === 1 ? 'only' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle';

function Pill({ label, onRemove }: { label: string; onRemove(): void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
      hitSlop={8}
      onPress={onRemove}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[1],
        borderRadius: t.radius.pill,
        backgroundColor: t.color.chartFill,
        paddingLeft: t.space[3],
        paddingRight: t.space[2],
        paddingVertical: t.space[1],
      }}
    >
      <Text variant="caption" color="accent">
        {label}
      </Text>
      <Icon name="close" size={12} color="accent" />
    </Pressable>
  );
}

export default function Exercises() {
  const t = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const exercises = useStore((s) => s.exercises);
  const programs = useStore((s) => s.programs);
  const owned = useStore((s) => s.equipment);
  const [input, setInput] = useState('');
  const query = useDebounced(input);
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState<Sheet>(null);

  const used = useMemo(() => new Set(programs.flatMap(exerciseIdsOf)), [programs]);
  const sorted = useMemo(
    () =>
      Object.values(exercises)
        .filter((e) => !e.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );
  const active = useMemo(() => ({ ...filters, query }), [filters, query]);
  const shown = useMemo(() => filterExercises(sorted, active), [sorted, active]);
  const narrowed = filterCount(filters) > 0 || query.trim().length > 0;
  const set = (patch: Partial<ExerciseFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clear = () => {
    setInput('');
    setFilters(EMPTY_FILTERS);
  };

  const pills = [
    ...filters.equipment.map((v) => ({
      key: `e-${v}`,
      label: EQUIPMENT_LABELS[v],
      remove: () => set({ equipment: filters.equipment.filter((x) => x !== v) }),
    })),
    ...filters.muscles.map((v) => ({
      key: `m-${v}`,
      label: MUSCLE_LABELS[v],
      remove: () => set({ muscles: filters.muscles.filter((x) => x !== v) }),
    })),
    ...filters.patterns.map((v) => ({
      key: `p-${v}`,
      label: PATTERN_LABELS[v],
      remove: () => set({ patterns: filters.patterns.filter((x) => x !== v) }),
    })),
  ];

  const renderItem = useCallback(
    ({ item, index }: { item: Exercise; index: number }) => (
      <ExerciseRow
        exercise={item}
        inProgram={used.has(item.id)}
        position={position(index, shown.length)}
        onOpen={open}
      />
    ),
    [used, shown.length],
  );

  const header = (
    <View style={{ gap: t.space[3], paddingBottom: t.space[4] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.color.borderStrong,
          backgroundColor: t.color.surface,
          paddingHorizontal: t.space[4],
          gap: t.space[2],
        }}
      >
        <TextInput
          accessibilityLabel="Search exercises"
          placeholder={`Search ${sorted.length} exercises`}
          placeholderTextColor={t.color.textMuted}
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          maxFontSizeMultiplier={1.6}
          style={[t.type.body, { flex: 1, minHeight: 54, color: t.color.text }]}
        />
        {input ? <IconButton icon="close" label="Clear search" onPress={() => setInput('')} /> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: t.space[2], paddingRight: gutter }}
        style={{ marginHorizontal: -gutter, paddingLeft: gutter }}
      >
        <Chip
          role="checkbox"
          label="Equipment"
          selected={filters.equipment.length > 0}
          onPress={() => setSheet('equipment')}
        />
        <Chip
          role="checkbox"
          label="Muscle"
          selected={filters.muscles.length > 0}
          onPress={() => setSheet('muscles')}
        />
        <Chip
          role="checkbox"
          label="Pattern"
          selected={filters.patterns.length > 0}
          onPress={() => setSheet('patterns')}
        />
        <Chip
          role="checkbox"
          label="Timed"
          selected={filters.timed}
          onPress={() => set({ timed: !filters.timed })}
        />
        {owned.length > 0 ? (
          <Chip
            role="checkbox"
            label="My equipment"
            selected={!!filters.onlyMine}
            onPress={() => set({ onlyMine: filters.onlyMine ? undefined : owned })}
          />
        ) : null}
      </ScrollView>
      {narrowed ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          {pills.map((p) => (
            <Pill key={p.key} label={p.label} onRemove={p.remove} />
          ))}
          <Text variant="callout" color="textMuted" accessibilityLiveRegion="polite">
            {pills.length > 0 ? '· ' : ''}
            {shown.length} {shown.length === 1 ? 'result' : 'results'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    // A plain View root: with the list itself as the screen root, iOS left the large title blank.
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen
        options={{
          title: 'Exercises',
          headerRight: () => (
            <IconButton icon="add" label="New exercise" onPress={() => router.push('/exercises/new')} />
          ),
        }}
      />
      <FlatList
        data={shown}
        renderItem={renderItem}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="lift"
            title="No exercises match"
            body="Try fewer filters or another word."
            action={{ title: 'Clear filters', onPress: clear }}
          />
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        style={{ flex: 1, backgroundColor: t.color.background }}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: t.space[6],
          paddingBottom: t.space[12] + insets.bottom,
        }}
      />
      <FilterSheet<Equipment>
        title="Equipment"
        visible={sheet === 'equipment'}
        options={EQUIPMENT_OPTIONS}
        selected={filters.equipment}
        onToggle={(v) => set({ equipment: toggle(filters.equipment, v) })}
        onClear={() => set({ equipment: [] })}
        onClose={() => setSheet(null)}
      />
      <FilterSheet<Muscle>
        title="Muscle"
        visible={sheet === 'muscles'}
        options={MUSCLE_OPTIONS}
        selected={filters.muscles}
        onToggle={(v) => set({ muscles: toggle(filters.muscles, v) })}
        onClear={() => set({ muscles: [] })}
        onClose={() => setSheet(null)}
      />
      <FilterSheet<Pattern>
        title="Pattern"
        visible={sheet === 'patterns'}
        options={PATTERN_OPTIONS}
        selected={filters.patterns}
        onToggle={(v) => set({ patterns: toggle(filters.patterns, v) })}
        onClear={() => set({ patterns: [] })}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
