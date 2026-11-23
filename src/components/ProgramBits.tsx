import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { ActiveProgram, SessionLog } from '../domain';
import { categoryOf } from '../programPicker';
import { useStore } from '../store';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { Text } from '../ui/Text';
import { WorkoutRow } from './WorkoutRow';

/** A small outlined label: a category, a status, or an equipment-fit note. */
export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const t = useTheme();
  const color = tone === 'neutral' ? 'textMuted' : tone;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: tone === 'neutral' ? t.color.border : t.color[tone],
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space[3],
        paddingVertical: t.space[1],
      }}
    >
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </View>
  );
}

/** The category pill of a program, or nothing for a program of a plan without one. */
export function CategoryPill({ program }: { program: Pick<ActiveProgram, 'template'> }) {
  const category = categoryOf(program.template);
  return category ? <Pill label={category} /> : null;
}

/** The pictogram of a program: the one of the first exercise of its first day. */
export function ProgramBadge({ program, size = 40 }: { program: ActiveProgram; size?: 40 | 56 }) {
  const exercises = useStore((s) => s.exercises);
  const first = program.days[0]?.slots[0]?.exercise;
  const exercise = exercises[Array.isArray(first) ? first[0] : (first ?? '')];
  return exercise ? <ExerciseBadge exercise={exercise} size={size} /> : null;
}

/** A logged workout with the name of its program above (history from before programs have none). */
export function LoggedWorkout({ log }: { log: SessionLog }) {
  const t = useTheme();
  const name = log.programName ?? 'Earlier program';
  return (
    <View style={{ paddingTop: t.space[3] }}>
      {/* Read as part of the row's own label, so screen readers do not say it twice. */}
      <Text
        variant="caption"
        color="accent"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {name}
      </Text>
      <WorkoutRow log={log} programName={name} />
    </View>
  );
}
