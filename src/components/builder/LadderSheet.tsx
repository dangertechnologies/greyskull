import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../../design/theme';
import type { Exercise } from '../../domain';
import { LADDERS } from '../../domain';
import { nameOf } from '../../format';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';

/** Pick one of the built-in ladders: a run of exercises from easiest to hardest. */
export function LadderSheet({
  selected,
  exercises,
  onPick,
  onClose,
}: {
  selected?: string;
  exercises: Record<string, Exercise>;
  onPick(id: string): void;
  onClose(): void;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet visible onClose={onClose} title="Choose a ladder">
      <ScrollView style={{ maxHeight: height * 0.55 }}>
        {LADDERS.map((l) => {
          const first = nameOf(exercises, l.steps[0].exercise);
          const last = nameOf(exercises, l.steps[l.steps.length - 1].exercise);
          const on = l.id === selected;
          return (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`${l.name}, ${l.steps.length} steps from ${first} to ${last}`}
              accessibilityState={{ selected: on }}
              onPress={() => onPick(l.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space[3],
                minHeight: 64,
                paddingVertical: t.space[3],
                backgroundColor: pressed ? t.color.border : 'transparent',
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{l.name}</Text>
                <Text variant="callout" color="textMuted">
                  {`${l.steps.length} ${l.steps.length === 1 ? 'step' : 'steps'}: ${first}${l.steps.length > 1 ? ` to ${last}` : ''}${l.after === 'weighted' ? ', then weighted' : ''}`}
                </Text>
              </View>
              {on ? <Icon name="check" size={20} color="accent" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
