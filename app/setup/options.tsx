import { Redirect, router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Stepper } from '../../src/components/Stepper';
import { getPlan } from '../../src/config/plans';
import { PLUGINS } from '../../src/domain';
import type { PluginId } from '../../src/domain';
import { useSetup } from '../../src/setup/SetupContext';
import { type } from '../../src/theme';

function Row({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <View style={styles.row}>
      <Text style={type.body}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export default function Options() {
  const { draft, rebuild } = useSetup();
  if (!draft.base) return <Redirect href="/setup/template" />;
  const template = draft.base.template;
  const plugins: PluginId[] = getPlan(template)?.plugins ?? [];
  const model = draft.rules.progression ?? 'amrap';
  const togglePlugin = (id: PluginId, on: boolean) =>
    rebuild({ plugins: on ? [...draft.plugins, id] : draft.plugins.filter((p) => p !== id) });
  const setRules = (patch: Partial<typeof draft.rules>) => rebuild({ rules: { ...draft.rules, ...patch } });

  return (
    <Screen>
      <Text style={type.title} accessibilityRole="header">Options</Text>

      {plugins.length > 0 ? <Text style={type.label}>Extras</Text> : null}
      {plugins.map((id) => (
        <Row key={id} label={PLUGINS[id].label} value={draft.plugins.includes(id)} onChange={(on) => togglePlugin(id, on)} />
      ))}

      <Text style={type.label}>Sessions per week</Text>
      <View style={styles.chips}>
        {([2, 3] as const).map((n) => (
          <Button
            key={n}
            title={String(n)}
            variant={draft.sessionsPerWeek === n ? 'outline' : 'link'}
            accessibilityLabel={`${n} sessions per week`}
            onPress={() => rebuild({ sessionsPerWeek: n })}
          />
        ))}
      </View>

      <Row label="Warm-up sets" value={draft.rules.warmups} onChange={(warmups) => setRules({ warmups })} />
      {model === 'amrap' ? (
        <Stepper label="Double the jump at (reps)" value={draft.rules.doubleAt} step={1} min={6} max={15} format={(v) => `${v}+`} onChange={(doubleAt) => setRules({ doubleAt })} />
      ) : null}
      <Stepper label="Deload" value={Math.round(draft.rules.deloadPct * 100)} step={5} min={5} max={20} format={(v) => `${v} %`} onChange={(v) => setRules({ deloadPct: v / 100 })} />
      <Stepper label="Fails before deload" value={draft.rules.failsBeforeDeload} step={1} min={0} max={3} format={String} onChange={(failsBeforeDeload) => setRules({ failsBeforeDeload })} />

      <Button title="Next" onPress={() => router.push('/setup/days')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  chips: { flexDirection: 'row', gap: 12 },
});
