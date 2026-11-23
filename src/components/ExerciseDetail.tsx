import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Exercise } from '../domain';
import { EQUIPMENT_LABELS, LEVEL_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from '../exerciseFilter';
import { openLink } from '../openLink';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { Section } from '../ui/Section';
import { Text } from '../ui/Text';

function Pill({ label, accent = false }: { label: string; accent?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderRadius: t.radius.pill,
        borderWidth: accent ? 0 : 1,
        borderColor: t.color.borderStrong,
        backgroundColor: accent ? t.color.chartFill : 'transparent',
        paddingHorizontal: t.space[4],
        paddingVertical: t.space[2],
      }}
    >
      <Text variant="bodyStrong" color={accent ? 'accent' : 'textMuted'}>
        {label}
      </Text>
    </View>
  );
}

const Wrap = ({ children, center = false }: { children: React.ReactNode; center?: boolean }) => {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: t.space[2],
        justifyContent: center ? 'center' : 'flex-start',
      }}
    >
      {children}
    </View>
  );
};

/** Read-only view of one exercise: a large pictogram, what it trains, how to do it, and the form video. */
export function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  const t = useTheme();
  const tips = (label: string, list: string[] | undefined, icon: 'do' | 'dont') =>
    list && list.length > 0 ? (
      <Section label={label}>
        <View style={{ gap: t.space[3] }}>
          {list.map((tip) => (
            <View key={tip} style={{ flexDirection: 'row', gap: t.space[3] }}>
              <Icon name={icon} size={22} color={icon === 'do' ? 'success' : 'danger'} />
              <Text style={{ flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      </Section>
    ) : null;

  return (
    <>
      <View style={{ alignItems: 'center', gap: t.space[4] }}>
        <ExerciseBadge exercise={exercise} size={160} />
        <Text variant="title" align="center" accessibilityRole="header">
          {exercise.name}
        </Text>
        <Wrap center>
          {exercise.pattern ? <Pill accent label={PATTERN_LABELS[exercise.pattern]} /> : null}
          {(exercise.equipment ?? []).map((q) => (
            <Pill key={q} label={EQUIPMENT_LABELS[q]} />
          ))}
          {exercise.level ? <Pill label={LEVEL_LABELS[exercise.level]} /> : null}
          {exercise.timed ? <Pill label="Timed" /> : null}
        </Wrap>
      </View>

      {(exercise.muscles ?? []).length > 0 ? (
        <Section label="Muscles">
          <Wrap>
            {(exercise.muscles ?? []).map((m) => (
              <Pill key={m} accent label={MUSCLE_LABELS[m]} />
            ))}
            {(exercise.secondary ?? []).map((m) => (
              <Pill key={m} label={MUSCLE_LABELS[m]} />
            ))}
          </Wrap>
        </Section>
      ) : null}

      {exercise.description ? (
        <Section label="How to">
          <Text>{exercise.description}</Text>
        </Section>
      ) : null}
      {tips('Good form', exercise.goodForm, 'do')}
      {tips('Avoid', exercise.badForm, 'dont')}

      {exercise.video || exercise.url ? (
        <Section card>
          {exercise.video ? (
            <ListRow
              title="Watch a form video"
              subtitle="Opens in your browser"
              leading={<Icon name="video" size={28} color="accent" />}
              accessory="chevron"
              accessibilityLabel={`Watch a form video: ${exercise.name}`}
              onPress={() => void openLink(exercise.video)}
            />
          ) : null}
          {exercise.url ? (
            <ListRow
              title="Read a guide"
              subtitle="Opens in your browser"
              leading={<Icon name="guide" size={28} color="accent" />}
              accessory="chevron"
              accessibilityLabel={`Read a guide: ${exercise.name}`}
              onPress={() => void openLink(exercise.url)}
            />
          ) : null}
        </Section>
      ) : null}
    </>
  );
}
