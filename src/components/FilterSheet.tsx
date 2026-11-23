import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../design/theme';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Sheet } from '../ui/Sheet';

/** A sheet of checkable chips for one filter (equipment, muscle, pattern). Changes apply as they are made. */
export function FilterSheet<T extends string>({
  title,
  visible,
  options,
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  title: string;
  visible: boolean;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle(value: T): void;
  onClear(): void;
  onClose(): void;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: height * 0.5 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
          {options.map((o) => (
            <Chip
              key={o.value}
              role="checkbox"
              label={o.label}
              selected={selected.includes(o.value)}
              onPress={() => onToggle(o.value)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: t.space[3] }}>
        <View style={{ flex: 1 }}>
          <Button title="Clear" variant="secondary" disabled={selected.length === 0} onPress={onClear} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Done" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}
