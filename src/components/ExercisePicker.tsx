import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Exercise } from '../domain';
import { colors, type } from '../theme';
import { Button } from './Button';
import { ExerciseIcon } from './ExerciseIcon';

interface Props {
  visible: boolean;
  title?: string;
  exercises: Record<string, Exercise>;
  /** Exercise ids that cannot be picked (already in the day, or already chosen). */
  exclude?: string[];
  onPick(id: string): void;
  onClose(): void;
}

/** Searchable list of all exercises, built-in and custom. */
export function ExercisePicker({
  visible,
  title = 'Choose an exercise',
  exercises,
  exclude = [],
  onPick,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const list = useMemo(
    () =>
      Object.values(exercises)
        .filter((e) => !exclude.includes(e.id) && e.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, exclude, query],
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <Text style={type.heading} accessibilityRole="header">
          {title}
        </Text>
        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search"
          placeholderTextColor={colors.dim}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          autoCorrect={false}
        />
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={type.small}>No exercises match.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => {
                setQuery('');
                onPick(item.id);
              }}
              style={styles.row}
            >
              <ExerciseIcon icon={item.icon} />
              <Text style={type.body}>{item.name}</Text>
              {item.custom ? <Text style={type.small}>custom</Text> : null}
            </Pressable>
          )}
        />
        <Button
          title="Cancel"
          variant="link"
          onPress={() => {
            setQuery('');
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 56, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 4,
    color: colors.text,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.faint,
  },
});
