import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { DEFAULT_RULES, TEMPLATES } from '../../src/domain';
import type { Program } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { colors, type } from '../../src/theme';

const SCRATCH: Program = {
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'Day 1', slots: [] }],
};

const CHOICES: { key: 'base' | 'phrak' | 'custom'; title: string; text: string; program: Program }[] = [
  { key: 'base', title: 'Greyskull LP', text: 'Press/Bench alternate · Squat Mon & Fri · Deadlift Wed', program: TEMPLATES.base },
  { key: 'phrak', title: "Phrak's GSLP", text: 'A: Chins, Press, Squat · B: Rows, Bench, Deadlift', program: TEMPLATES.phrak },
  { key: 'custom', title: 'From scratch', text: 'Start with one empty day and build your own', program: SCRATCH },
];

export default function Template() {
  const { draft, rebuild } = useSetup();
  const chosen = draft.base?.template;
  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">Pick a program</Text>
      {CHOICES.map((c) => (
        <Pressable
          key={c.key}
          accessibilityRole="radio"
          accessibilityState={{ selected: chosen === c.key }}
          onPress={() => rebuild({ base: c.program, plugins: [], sessionsPerWeek: c.program.sessionsPerWeek, rules: { ...c.program.rules } })}
          style={[styles.card, chosen === c.key && styles.selected]}
        >
          <Text style={type.heading}>{c.title}</Text>
          <Text style={type.small}>{c.text}</Text>
        </Pressable>
      ))}
      <Button title="Next" disabled={!draft.base} onPress={() => router.push('/setup/options')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.faint, backgroundColor: colors.card },
  selected: { borderColor: colors.text },
});
