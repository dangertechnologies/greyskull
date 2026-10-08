import { Pressable, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { SessionItem } from '../hooks/useSession';
import { Text } from '../ui/Text';

/**
 * One pill per set of the current exercise: filled when logged, outlined when open, accent ring on the one
 * being shown. Tap any set to see or correct it (this is the undo for a mistaken Done).
 */
export function SetRail({
  items,
  indices,
  selectedIndex,
  onSelect,
}: {
  items: SessionItem[];
  /** Positions in `items` of this exercise's sets, in order. */
  indices: number[];
  selectedIndex: number;
  onSelect(index: number): void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], alignItems: 'center' }}>
      {indices.map((index) => {
        const item = items[index];
        const selected = index === selectedIndex;
        const warmup = item.kind === 'warmup';
        const logged = item.logged;
        const label = warmup
          ? `Warm-up ${item.position} of ${item.total}${logged ? ', done' : ''}`
          : `Set ${item.position} of ${item.total}, ${logged ? `${item.reps} reps done` : `target ${item.targetReps ?? 'as many as possible'}`}`;
        return (
          <Pressable
            key={`${item.kind}-${item.position}`}
            testID={warmup ? undefined : `set-pill-${item.exerciseId}-${item.position}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(index)}
            hitSlop={4}
            style={{
              minWidth: warmup ? 36 : 52,
              height: warmup ? 36 : 52,
              paddingHorizontal: t.space[2],
              borderRadius: t.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: logged ? (warmup ? t.color.surfaceRaised : t.color.success) : 'transparent',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? t.color.accent : logged ? 'transparent' : t.color.borderStrong,
            }}
          >
            <Text
              variant={warmup ? 'caption' : 'bodyStrong'}
              color={logged && !warmup ? 'background' : warmup ? 'textMuted' : 'text'}
              maxFontSizeMultiplier={1.2}
            >
              {warmup
                ? 'W'
                : logged
                  ? String(item.reps)
                  : item.targetReps === null
                    ? '5+'
                    : String(item.targetReps)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
