import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useTheme } from '../design/theme';
import type { SessionLog } from '../domain';
import { formatDate, summarize } from '../format';
import { useStore } from '../store';
import { Text } from '../ui/Text';

/** A logged workout in Today's "Recent" and in History: tap to edit; skipped ones are muted. */
export function WorkoutRow({ log }: { log: SessionLog }) {
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const t = useTheme();
  const meta = [
    log.finishedAt ? formatDate(log.finishedAt) : null,
    log.dayName ? null : 'Imported',
    log.skipped ? 'Skipped' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Workout ${log.n + 1}, ${log.skipped ? 'skipped' : 'edit'}`}
      onPress={() => !log.skipped && router.push(`/session/edit/${log.n}`)}
      style={{ paddingVertical: t.space[3], gap: t.space[1] }}
    >
      <Text variant="bodyStrong" color={log.skipped ? 'textMuted' : 'text'}>
        {`Workout ${log.n + 1}${log.dayName ? ` · ${log.dayName}` : ''}`}
      </Text>
      <Text variant="caption" color="textMuted">
        {meta}
      </Text>
      {log.skipped ? null : (
        <Text variant="callout" color="textMuted">
          {summarize(log, exercises, unit)}
        </Text>
      )}
    </Pressable>
  );
}
