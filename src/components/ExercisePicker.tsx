import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import type { Equipment, Exercise, Muscle, Pattern } from '../domain';
import {
  EMPTY_FILTERS,
  EQUIPMENT_LABELS,
  type ExerciseFilters,
  filterCount,
  filterExercises,
  MUSCLE_LABELS,
  PATTERN_LABELS,
  subtitleOf,
} from '../exerciseFilter';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { Icon } from '../ui/Icon';
import { useGutter } from '../ui/layout';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { FilterSheet } from './FilterSheet';

interface Props {
  visible: boolean;
  title?: string;
  exercises: Record<string, Exercise>;
  /** Exercise ids that cannot be picked (already in the day, or already chosen). */
  exclude?: string[];
  onPick(id: string): void;
  onClose(): void;
}

type Sheet = 'equipment' | 'muscles' | 'patterns' | null;

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const EQUIPMENT_OPTIONS = options(EQUIPMENT_LABELS);
const MUSCLE_OPTIONS = options(MUSCLE_LABELS);
const PATTERN_OPTIONS = options(PATTERN_LABELS);

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

/** A row of the list. Memoised, so typing in the search box redraws only the rows that appear or go. */
const PickerRow = memo(function PickerRow({
  exercise,
  onPick,
}: {
  exercise: Exercise;
  onPick(id: string): void;
}) {
  const t = useTheme();
  const subtitle = subtitleOf(exercise);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      accessibilityHint={subtitle || undefined}
      onPress={() => onPick(exercise.id)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[4],
        minHeight: 64,
        paddingVertical: t.space[2],
        backgroundColor: pressed ? t.color.surface : 'transparent',
      })}
    >
      <ExerciseBadge exercise={exercise} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{exercise.name}</Text>
        {subtitle ? (
          <Text variant="callout" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {exercise.timed ? (
        <Text variant="caption" color="textMuted">
          timed
        </Text>
      ) : null}
      {exercise.custom ? (
        <Text variant="caption" color="textMuted">
          custom
        </Text>
      ) : null}
    </Pressable>
  );
});

/** A filter chip that opens a list; accent-tinted when something is picked in it. */
function SheetChip({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens a list of choices"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 56,
        paddingHorizontal: t.space[4],
        flexDirection: 'row',
        gap: t.space[1],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: active ? t.color.accent : t.color.borderStrong,
        backgroundColor: active ? t.color.chartFill : 'transparent',
      }}
    >
      <Text variant="bodyStrong" color={active ? 'accent' : 'text'}>
        {label}
      </Text>
      <Icon name="down" size={12} color={active ? 'accent' : 'textMuted'} />
    </Pressable>
  );
}

/** Searchable, filterable list of all exercises, built-in and custom. */
export function ExercisePicker({
  visible,
  title = 'Choose an exercise',
  exercises,
  exclude = [],
  onPick,
  onClose,
}: Props) {
  const t = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const owned = useStore((s) => s.equipment);
  const [input, setInput] = useState('');
  // The search text is applied 150 ms after the last keystroke, so a long list is not redrawn on every letter.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQuery(input), 150);
    return () => clearTimeout(id);
  }, [input]);
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [mineOnly, setMineOnly] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const set = (patch: Partial<ExerciseFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const sorted = useMemo(
    () =>
      Object.values(exercises)
        .filter((e) => !e.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );
  const taken = exclude.join('\n');
  const list = useMemo(() => {
    const skip = new Set(taken ? taken.split('\n') : []);
    const active = { ...filters, query, onlyMine: mineOnly ? owned : undefined };
    return filterExercises(sorted, active).filter((e) => !skip.has(e.id));
  }, [sorted, filters, query, mineOnly, owned, taken]);
  const narrowed =
    filterCount({ ...filters, onlyMine: mineOnly ? owned : undefined }) > 0 || query.trim() !== '';

  const reset = useCallback(() => {
    setInput('');
    setQuery('');
    setFilters(EMPTY_FILTERS);
    setMineOnly(false);
  }, []);
  const close = () => {
    reset();
    onClose();
  };
  const pick = useCallback(
    (id: string) => {
      reset();
      onPick(id);
    },
    [onPick, reset],
  );
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => <PickerRow exercise={item} onPick={pick} />,
    [pick],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.background,
          paddingTop: t.space[6],
          paddingHorizontal: gutter,
          gap: t.space[4],
        }}
      >
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        <TextField
          label="Search exercises"
          placeholder={`Search ${sorted.length} exercises`}
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, flexShrink: 0, marginHorizontal: -gutter }}
          contentContainerStyle={{ gap: t.space[2], paddingHorizontal: gutter }}
        >
          <SheetChip
            label="Equipment"
            active={filters.equipment.length > 0}
            onPress={() => setSheet('equipment')}
          />
          <SheetChip label="Muscle" active={filters.muscles.length > 0} onPress={() => setSheet('muscles')} />
          <SheetChip
            label="Pattern"
            active={filters.patterns.length > 0}
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
              selected={mineOnly}
              onPress={() => setMineOnly(!mineOnly)}
            />
          ) : null}
        </ScrollView>
        {narrowed ? (
          <Text variant="callout" color="textMuted" accessibilityLiveRegion="polite">
            {list.length} {list.length === 1 ? 'result' : 'results'}
          </Text>
        ) : null}
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={{ gap: t.space[3], alignItems: 'flex-start' }}>
              <Text color="textMuted">No exercises match.</Text>
              {narrowed ? <Button title="Clear filters" variant="secondary" onPress={reset} /> : null}
            </View>
          }
        />
        <View style={{ paddingBottom: insets.bottom + t.space[4] }}>
          <Button title="Cancel" variant="secondary" onPress={close} />
        </View>
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
    </Modal>
  );
}
