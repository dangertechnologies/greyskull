import { router } from 'expo-router';
import { View } from 'react-native';
import { getPlan } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import { nameOf, schemeLabel } from '../../src/format';
import { useStore } from '../../src/store';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

export default function Plan() {
  const program = useStore((s) => s.program);
  const exercises = useStore((s) => s.exercises);
  const t = useTheme();
  const plan = program ? getPlan(program.template) : undefined;
  const name = plan?.name ?? 'Custom plan';

  return (
    <ScreenScroll headerless gap={10}>
      <Text variant="title" accessibilityRole="header">
        Plan
      </Text>

      <Card style={{ gap: t.space[2] }}>
        <Text variant="headline">{name}</Text>
        <Text variant="callout" color="textMuted">
          {program
            ? `${program.days.length} days · ${program.sessionsPerWeek} sessions a week`
            : 'No plan yet'}
        </Text>
        {plan?.status === 'experimental' ? (
          <Text variant="caption" color="warning">
            Experimental plan
          </Text>
        ) : null}
      </Card>

      {program ? (
        <Section label="Days">
          <View style={{ gap: t.space[5] }}>
            {program.days.map((day) => (
              <View key={day.name} style={{ gap: t.space[1] }}>
                <Text variant="bodyStrong">
                  {day.intensity && day.intensity < 1
                    ? `${day.name} · ${Math.round(day.intensity * 100)} %`
                    : day.name}
                </Text>
                {day.slots.map((slot) => {
                  const ids = typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise;
                  return (
                    <Text key={ids.join('/')} variant="callout" color="textMuted">
                      {`${ids.map((id) => nameOf(exercises, id, true)).join(' / ')} · ${schemeLabel(slot.scheme)}`}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      <Section label="Edit">
        <View>
          <ListRow
            title="Days and exercises"
            accessory="chevron"
            onPress={() => router.push('/setup/days?edit=1')}
          />
          <ListRow title="Progression rules" accessory="chevron" onPress={() => router.push('/plan/rules')} />
          <ListRow
            title="Exercises"
            subtitle="Form tips, videos, custom exercises"
            accessory="chevron"
            onPress={() => router.push('/exercises')}
          />
          <ListRow
            title="Change plan"
            subtitle="Keeps your weights and history"
            accessory="chevron"
            onPress={() => router.push('/setup/plan?change=1')}
          />
        </View>
      </Section>
    </ScreenScroll>
  );
}
