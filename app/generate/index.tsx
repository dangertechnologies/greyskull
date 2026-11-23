import { router, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../src/design/theme';
import type { Equipment } from '../../src/domain';
import { EQUIPMENT_LABELS } from '../../src/exerciseFilter';
import {
  type Answers,
  DEFAULT_ANSWERS,
  EXPERIENCE,
  EXPERIENCE_LABELS,
  encodeAnswers,
  GOAL_LABELS,
  GOALS,
  MINUTES,
} from '../../src/generate/recommend';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { ListRow } from '../../src/ui/ListRow';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

/** Equipment offered as chips; anything else the user already set in the gym settings is added. */
const OFFERED: Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'bench',
  'pull-up-bar',
  'dip-bars',
  'rings',
  'parallettes',
  'bands',
  'box',
  'cable',
  'machine',
];

function Chips({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>{children}</View>;
}

/** Five questions that work on every device; the answers lead to built-in programs or to "Describe it". */
export default function GenerateQuestions() {
  const owned = useStore((s) => s.equipment);
  const [answers, setAnswers] = useState<Answers>(() => ({ ...DEFAULT_ANSWERS, equipment: [...owned] }));
  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));
  const equipmentChips = [...OFFERED, ...owned.filter((e) => e !== 'none' && !OFFERED.includes(e))];
  const toggle = (e: Equipment) =>
    set({
      equipment: answers.equipment.includes(e)
        ? answers.equipment.filter((x) => x !== e)
        : [...answers.equipment, e],
    });
  const query = `?a=${encodeURIComponent(encodeAnswers(answers))}`;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Build me a program' }} />
      <ScreenScroll withBottomBar gap={8}>
        <Section label="Goal">
          <Chips>
            {GOALS.map((g) => (
              <Chip
                key={g}
                label={GOAL_LABELS[g]}
                selected={answers.goal === g}
                onPress={() => set({ goal: g })}
              />
            ))}
          </Chips>
        </Section>
        <Section label="Days a week">
          <Chips>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={answers.days === n}
                onPress={() => set({ days: n })}
              />
            ))}
          </Chips>
        </Section>
        <Section label="Session length">
          <Chips>
            {MINUTES.map((m) => (
              <Chip
                key={m}
                label={`${m} min`}
                selected={answers.minutes === m}
                onPress={() => set({ minutes: m })}
              />
            ))}
          </Chips>
        </Section>
        <Section
          label="Equipment"
          footer={answers.equipment.length === 0 ? 'None picked: every program is considered.' : undefined}
        >
          <Chips>
            {equipmentChips.map((e) => (
              <Chip
                key={e}
                role="checkbox"
                label={EQUIPMENT_LABELS[e]}
                selected={answers.equipment.includes(e)}
                onPress={() => toggle(e)}
              />
            ))}
          </Chips>
        </Section>
        <Section label="Experience">
          <Chips>
            {EXPERIENCE.map((x) => (
              <Chip
                key={x}
                label={EXPERIENCE_LABELS[x]}
                selected={answers.experience === x}
                onPress={() => set({ experience: x })}
              />
            ))}
          </Chips>
        </Section>
        <ListRow
          title="Describe it instead"
          subtitle="In your own words, with the on-device model"
          accessory="chevron"
          testID="generate-describe"
          onPress={() => router.push(`/generate/describe${query}`)}
        />
        <Text variant="callout" color="textMuted">
          Nothing here needs an account or a network.
        </Text>
      </ScreenScroll>
      <BottomBar>
        <Button
          title="See recommendations"
          size="lg"
          testID="generate-recommend"
          onPress={() => router.push(`/generate/results${query}`)}
        />
      </BottomBar>
    </View>
  );
}
