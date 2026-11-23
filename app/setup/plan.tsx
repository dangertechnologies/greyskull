import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Pill } from '../../src/components/ProgramBits';
import { RulesEditor } from '../../src/components/RulesEditor';
import { getPlan, PLANS } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import type { PluginId, Program } from '../../src/domain';
import { DEFAULT_RULES, PLUGINS } from '../../src/domain';
import { goBackOr } from '../../src/navigation';
import {
  CATEGORIES,
  type Category,
  categoryOf,
  equipmentFit,
  fitLabel,
  laterLabel,
} from '../../src/programPicker';
import { useSetup } from '../../src/setup/SetupContext';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { Icon } from '../../src/ui/Icon';
import { IconButton } from '../../src/ui/IconButton';
import { ListRow } from '../../src/ui/ListRow';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { NumberStepper } from '../../src/ui/NumberStepper';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

const SCRATCH: Program = {
  template: 'custom',
  sessionsPerWeek: 3,
  rules: DEFAULT_RULES,
  days: [{ name: 'Day 1', slots: [] }],
};

interface Choice {
  id: string;
  title: string;
  summary: string;
  description: string;
  experimental: boolean;
  program: Program;
  category: Category | null;
}

const BUILT_IN: Choice[] = PLANS.map((p) => ({
  id: p.id,
  title: p.name,
  summary: p.summary,
  description: p.description,
  experimental: p.status === 'experimental',
  program: p.program,
  category: categoryOf(p.id),
}));

const FROM_SCRATCH: Choice = {
  id: 'custom',
  title: 'From scratch',
  summary: 'Start with one empty day and build your own',
  description:
    'Uses Greyskull-style AMRAP progression. You can change days, exercises and schemes later in Programs.',
  experimental: false,
  program: SCRATCH,
  category: null,
};

export default function PlanStep() {
  const {
    change,
    add,
    pick,
    program: programId,
  } = useLocalSearchParams<{ change?: string; add?: string; pick?: string; program?: string }>();
  const { draft, rebuild } = useSetup();
  const t = useTheme();
  const customPlans = useStore((s) => s.customPlans);
  const exercises = useStore((s) => s.exercises);
  const equipment = useStore((s) => s.equipment);
  const [advanced, setAdvanced] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [chosen, setChosen] = useState<string | null>(draft.base?.template ?? null);
  const changing = change === '1';
  const adding = add === '1';
  const plugins: PluginId[] = (chosen && getPlan(chosen)?.plugins) || [];

  const mine: Choice[] = customPlans.map((c) => ({
    id: c.id,
    title: c.name,
    summary: c.summary ?? `${c.program.days.length} days`,
    description: '',
    experimental: false,
    program: c.program,
    category: null,
  }));
  // A plan that is chosen stays listed whatever the filter says, so Next never applies to a hidden plan.
  const shown = category
    ? [...BUILT_IN, FROM_SCRATCH].filter((c) => c.category === category || c.id === chosen)
    : [...BUILT_IN, FROM_SCRATCH];
  const isSaved = mine.some((c) => c.id === chosen);

  const choose = (c: Choice) => {
    setChosen(c.id);
    rebuild({
      base: c.program,
      plugins: [],
      sessionsPerWeek: c.program.sessionsPerWeek,
      rules: { ...c.program.rules },
    });
  };
  // Opened from "My programs" on the Programs tab, or from a recommendation of "Generate a program": that
  // program starts out chosen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the screen opens
  useEffect(() => {
    const saved = [...mine, ...BUILT_IN, FROM_SCRATCH].find((c) => c.id === pick);
    if (saved) choose(saved);
  }, []);

  const togglePlugin = (id: PluginId, on: boolean) =>
    rebuild({ plugins: on ? [...draft.plugins, id] : draft.plugins.filter((p) => p !== id) });

  const next = () => {
    const query = changing
      ? `?change=1&program=${programId}`
      : adding
        ? `?add=1${isSaved ? `&custom=${chosen}` : ''}`
        : '';
    router.push(`/setup/review${query}`);
  };

  const renderChoice = (c: Choice) => {
    const selected = chosen === c.id;
    const fit = equipmentFit(c.program, exercises, equipment);
    // While setting up for the first time, only a known fit or miss is worth a badge.
    const showFit = c.id !== 'custom' && (adding || fit.status !== 'unknown');
    return (
      <View
        key={c.id}
        style={{
          borderRadius: t.radius.xl,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? t.color.accent : t.color.border,
          backgroundColor: t.color.surface,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={`${c.title}${c.experimental ? ', experimental' : ''}`}
          accessibilityHint={
            showFit ? [c.summary, fitLabel(fit), laterLabel(fit)].filter(Boolean).join('. ') : c.summary
          }
          accessibilityState={{ selected }}
          onPress={() => choose(c)}
          style={{ padding: t.space[5], gap: t.space[2] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
            <Text variant="headline" style={{ flex: 1 }}>
              {c.title}
            </Text>
            {c.experimental ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: t.color.warning,
                  borderRadius: t.radius.pill,
                  paddingHorizontal: t.space[3],
                  paddingVertical: t.space[1],
                }}
              >
                <Text variant="label" color="warning">
                  Experimental
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="callout" color="textMuted">
            {c.summary}
          </Text>
          {showFit ? (
            <Pill
              label={fitLabel(fit)}
              tone={fit.status === 'fits' ? 'success' : fit.status === 'missing' ? 'warning' : 'neutral'}
            />
          ) : null}
          {showFit && laterLabel(fit) ? (
            <Text variant="caption" color="textMuted">
              {laterLabel(fit)}
            </Text>
          ) : null}
          {selected && c.description ? <Text style={{ paddingTop: t.space[3] }}>{c.description}</Text> : null}
        </Pressable>

        {selected ? (
          <View style={{ padding: t.space[5], paddingTop: 0, gap: t.space[6] }}>
            {plugins.length > 0 ? (
              <Section label="Extras">
                <View>
                  {plugins.map((id) => (
                    <ListRow
                      key={id}
                      title={PLUGINS[id].label}
                      accessory="switch"
                      switchValue={draft.plugins.includes(id)}
                      onSwitch={(on) => togglePlugin(id, on)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}
            <NumberStepper
              label="Training days per week"
              value={draft.sessionsPerWeek}
              min={1}
              max={7}
              step={1}
              format={String}
              onChange={(sessionsPerWeek) => rebuild({ sessionsPerWeek })}
            />
            <Button
              title={advanced ? 'Hide advanced rules' : 'Advanced rules'}
              variant="plain"
              onPress={() => setAdvanced((a) => !a)}
            />
            {advanced ? <RulesEditor rules={draft.rules} onChange={(rules) => rebuild({ rules })} /> : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen
        options={{
          title: changing ? 'Change plan' : adding ? 'Add a program' : 'Pick a program',
          // Opened from a tab, this is the first screen of the setup stack: it has no back button of its own.
          ...(changing || adding
            ? { headerLeft: () => <IconButton icon="back" label="Back" onPress={() => goBackOr('/')} /> }
            : {}),
        }}
      />
      <ScreenScroll withBottomBar gap={4}>
        {changing || adding ? null : (
          <Text variant="label" color="textMuted">
            Step 2 of 3
          </Text>
        )}
        <Text color="textMuted">You can change this later. Your history is kept.</Text>
        {/* Wrapped, not a sideways scroll: every category stays visible at any width and text size. */}
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], paddingVertical: t.space[3] }}
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          ))}
        </View>
        <View style={{ gap: t.space[4] }}>
          {shown.length === 0 ? (
            <Text color="textMuted">No programs in this category yet.</Text>
          ) : (
            shown.map(renderChoice)
          )}
        </View>
        {adding ? (
          <ListRow
            title="Generate a program"
            subtitle="Answer a few questions, or describe it in your own words"
            leading={<Icon name="sparkles" color="accent" />}
            accessory="chevron"
            testID="setup-generate"
            onPress={() => router.push('/generate')}
          />
        ) : null}
        {mine.length > 0 ? (
          <View style={{ gap: t.space[3], paddingTop: t.space[6] }}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              My programs
            </Text>
            <View style={{ gap: t.space[4] }}>{mine.map(renderChoice)}</View>
          </View>
        ) : null}
      </ScreenScroll>
      <BottomBar>
        <Button title="Next" size="lg" testID="setup-next" disabled={!draft.base} onPress={next} />
      </BottomBar>
    </View>
  );
}
