import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { PLANS } from '../../src/config/plans';
import type { Program } from '../../src/domain';
import { DEFAULT_RULES } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { colors, type } from '../../src/theme';

const SCRATCH: Program = {
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'Day 1', slots: [] }],
};

const CHOICES = [
  ...PLANS.map((p) => ({
    id: p.id,
    title: p.name,
    summary: p.summary,
    description: p.description,
    experimental: p.status === 'experimental',
    program: p.program,
  })),
  {
    id: 'custom',
    title: 'From scratch',
    summary: 'Start with one empty day and build your own',
    description:
      'Uses Greyskull-style AMRAP progression. You can change days, exercises and schemes later in Settings.',
    experimental: false,
    program: SCRATCH,
  },
];

export default function Template() {
  const { draft, rebuild } = useSetup();
  const chosen = draft.base?.template;
  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">
        Pick a program
      </Text>
      {CHOICES.map((c) => {
        const selected = chosen === c.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityLabel={`${c.title}${c.experimental ? ', experimental' : ''}`}
            accessibilityHint={c.summary}
            accessibilityState={{ selected }}
            onPress={() =>
              rebuild({
                base: c.program,
                plugins: [],
                sessionsPerWeek: c.program.sessionsPerWeek,
                rules: { ...c.program.rules },
              })
            }
            style={[styles.card, selected && styles.selected]}
          >
            <View style={styles.titleRow}>
              <Text style={[type.heading, { flex: 1 }]}>{c.title}</Text>
              {c.experimental ? <Text style={styles.badge}>Experimental</Text> : null}
            </View>
            <Text style={type.small}>{c.summary}</Text>
            {selected ? <Text style={type.body}>{c.description}</Text> : null}
          </Pressable>
        );
      })}
      <Button title="Next" disabled={!draft.base} onPress={() => router.push('/setup/options')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.faint,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: colors.dim,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
