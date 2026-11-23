import { Pressable, View } from 'react-native';
import { useTheme } from '../design/theme';
import { formatWeight } from '../domain';
import type { SessionItem } from '../hooks/useSession';
import { useStore } from '../store';
import { Text } from '../ui/Text';

/**
 * One pill per set of the current exercise: filled when logged, outlined when open (dashed for warm-ups),
 * accent ring on the one being shown. All pills are one size, so the row reads as one count of sets. Tap any
 * set to see or correct it (this is the undo for a mistaken Done).
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
  const unit = useStore((s) => s.unit);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], alignItems: 'center' }}>
      {indices.map((index) => {
        const item = items[index];
        const selected = index === selectedIndex;
        const warmup = item.kind === 'warmup';
        const logged = item.logged;
        const unitWord = item.timed ? 'seconds' : 'reps';
        const label = warmup
          ? `Warm-up ${item.position} of ${item.total}${logged ? ', done' : ''}`
          : `Set ${item.position} of ${item.total}, ${logged ? `${item.reps} ${unitWord} done` : `target ${item.targetReps === null ? 'as many as possible' : `${item.targetReps}${item.timed ? ' seconds' : ''}`}`}`;
        const s = item.timed ? ' s' : '';
        return (
          <Pressable
            key={`${item.kind}-${item.position}`}
            testID={warmup ? undefined : `set-pill-${item.exerciseId}-${item.position}`}
            accessibilityRole="button"
            accessibilityLabel={`${label}${item.perSetWeight ? `, ${formatWeight(item.weightKg, unit)}` : ''}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(index)}
            hitSlop={4}
            style={{
              minWidth: 48,
              height: 48,
              paddingHorizontal: t.space[2],
              borderRadius: t.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: logged ? (warmup ? t.color.surfaceRaised : t.color.success) : 'transparent',
              borderWidth: selected ? 2 : 1,
              borderStyle: warmup && !logged && !selected ? 'dashed' : 'solid',
              borderColor: selected ? t.color.accent : logged ? 'transparent' : t.color.borderStrong,
            }}
          >
            <Text
              variant="bodyStrong"
              color={logged && !warmup ? 'background' : warmup ? 'textMuted' : 'text'}
              maxFontSizeMultiplier={1.2}
            >
              {warmup
                ? 'W'
                : logged
                  ? `${item.reps}${s}`
                  : item.targetReps === null
                    ? `${item.minReps ?? 5}+`
                    : `${item.targetReps}${s}`}
            </Text>
            {item.perSetWeight ? (
              <Text variant="caption" color={logged ? 'background' : 'textMuted'}>
                {formatWeight(item.weightKg, unit)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
