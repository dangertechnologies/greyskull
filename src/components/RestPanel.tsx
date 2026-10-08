import { View } from 'react-native';
import { useTheme } from '../design/theme';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Rest countdown that lives in the bottom bar, so the set rail and the exercise stay visible. */
export function RestPanel({
  remaining,
  total,
  next,
  onAdd,
  onSkip,
}: {
  remaining: number;
  total: number;
  /** What comes after the rest, e.g. "Set 3 of 5 · 20 kg × 5". */
  next?: string;
  onAdd(seconds: number): void;
  onSkip(): void;
}) {
  const t = useTheme();
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <View style={{ gap: t.space[4] }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="label" color="textMuted">
          Rest
        </Text>
        <Text
          variant="numberLarge"
          accessibilityLabel={`${remaining} seconds remaining`}
          testID="rest-remaining"
        >
          {clock(remaining)}
        </Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ height: 6, borderRadius: 3, backgroundColor: t.color.border, overflow: 'hidden' }}
      >
        <View style={{ width: `${fraction * 100}%`, height: 6, backgroundColor: t.color.accent }} />
      </View>
      {next ? <Text variant="callout" color="textMuted">{`Next: ${next}`}</Text> : null}
      <View style={{ flexDirection: 'row', gap: t.space[3] }}>
        <View style={{ flex: 1 }}>
          <Button
            title="−30 s"
            variant="secondary"
            accessibilityLabel="Shorten rest by 30 seconds"
            onPress={() => onAdd(-30)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="+30 s"
            variant="secondary"
            accessibilityLabel="Lengthen rest by 30 seconds"
            onPress={() => onAdd(30)}
          />
        </View>
      </View>
      <Button title="Skip rest" testID="rest-skip" onPress={onSkip} />
    </View>
  );
}
