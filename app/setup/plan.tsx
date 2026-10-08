import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { RulesEditor } from '../../src/components/RulesEditor';
import { getPlan, PLANS } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import type { PluginId, Program } from '../../src/domain';
import { DEFAULT_RULES, PLUGINS } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { Button } from '../../src/ui/Button';
import { ListRow } from '../../src/ui/ListRow';
import { BottomBar, ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { SegmentedControl } from '../../src/ui/SegmentedControl';
import { Text } from '../../src/ui/Text';

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
      'Uses Greyskull-style AMRAP progression. You can change days, exercises and schemes later in Plan.',
    experimental: false,
    program: SCRATCH,
  },
];

export default function PlanStep() {
  const { change } = useLocalSearchParams<{ change?: string }>();
  const { draft, rebuild } = useSetup();
  const t = useTheme();
  const [advanced, setAdvanced] = useState(false);
  const chosen = draft.base?.template;
  const plugins: PluginId[] = (chosen && getPlan(chosen)?.plugins) || [];
  const togglePlugin = (id: PluginId, on: boolean) =>
    rebuild({ plugins: on ? [...draft.plugins, id] : draft.plugins.filter((p) => p !== id) });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <Stack.Screen options={{ title: change === '1' ? 'Change plan' : 'Pick a program' }} />
      <ScreenScroll withBottomBar gap={4}>
        {change === '1' ? null : (
          <Text variant="label" color="textMuted">
            Step 2 of 3
          </Text>
        )}
        <Text color="textMuted">You can change this later. Your history is kept.</Text>
        <View style={{ height: t.space[4] }} />
        <View style={{ gap: t.space[4] }}>
          {CHOICES.map((c) => {
            const selected = chosen === c.id;
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
                  {selected ? <Text style={{ paddingTop: t.space[3] }}>{c.description}</Text> : null}
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
                    <Section label="Sessions per week">
                      <SegmentedControl
                        accessibilityLabel="Sessions per week"
                        options={[
                          { value: '2', label: '2' },
                          { value: '3', label: '3' },
                        ]}
                        value={String(draft.sessionsPerWeek)}
                        onChange={(v) => rebuild({ sessionsPerWeek: Number(v) as 2 | 3 })}
                      />
                    </Section>
                    <Button
                      title={advanced ? 'Hide advanced rules' : 'Advanced rules'}
                      variant="plain"
                      onPress={() => setAdvanced((a) => !a)}
                    />
                    {advanced ? (
                      <RulesEditor rules={draft.rules} onChange={(rules) => rebuild({ rules })} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScreenScroll>
      <BottomBar>
        <Button
          title="Next"
          size="lg"
          testID="setup-next"
          disabled={!draft.base}
          onPress={() => router.push(change === '1' ? '/setup/review?change=1' : '/setup/review')}
        />
      </BottomBar>
    </View>
  );
}
