import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { Button } from '../ui/Button';
import { useGutter } from '../ui/layout';
import { Monogram } from '../ui/Monogram';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';

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
  const t = useTheme();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const list = useMemo(
    () =>
      Object.values(exercises)
        .filter((e) => !exclude.includes(e.id) && e.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, exclude, query],
  );
  const close = () => {
    setQuery('');
    onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.background,
          paddingTop: t.space[6],
          paddingHorizontal: gutter,
          gap: t.space[5],
        }}
      >
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        <TextField
          label="Search exercises"
          placeholder="Search"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text color="textMuted">No exercises match.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => {
                setQuery('');
                onPick(item.id);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[4],
                minHeight: 64,
                backgroundColor: pressed ? t.color.surface : 'transparent',
              })}
            >
              <Monogram exercise={item} size={40} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {item.name}
              </Text>
              {item.custom ? (
                <Text variant="caption" color="textMuted">
                  custom
                </Text>
              ) : null}
            </Pressable>
          )}
        />
        <View style={{ paddingBottom: insets.bottom + t.space[4] }}>
          <Button title="Cancel" variant="secondary" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
