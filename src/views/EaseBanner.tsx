import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { SessionLog } from '../domain';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { easeSummary } from './ladder';

/** After a break: what was eased, with Undo. Shown only until the first set is logged (Undo is refused after). */
export function EaseBanner({ draft }: { draft: SessionLog }) {
  const t = useTheme();
  const stored = useStore((s) => s.programs.find((p) => p.id === draft.programId)?.lifts);
  const undoEase = useStore((s) => s.undoEase);
  const logged = Object.values(draft.results).some((r) => r.sets.some((x) => x.reps > 0));
  if (!draft.eased || logged) return null;
  const text = easeSummary(draft.eased, stored ?? {});
  return (
    <View
      testID="ease-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[3],
        padding: t.space[4],
        borderRadius: t.radius.lg,
        borderWidth: 1.5,
        borderColor: t.color.warning,
        backgroundColor: t.color.surface,
      }}
    >
      <Icon name="calendar" size={22} color="warning" />
      <Text variant="callout" style={{ flex: 1 }}>
        {text}
      </Text>
      <Button
        title="Undo"
        variant="plain"
        testID="undo-ease"
        accessibilityLabel="Undo the ease and use your stored weights"
        onPress={undoEase}
      />
    </View>
  );
}
