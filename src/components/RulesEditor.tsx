import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Rules } from '../domain';
import { ListRow } from '../ui/ListRow';
import { NumberStepper } from '../ui/NumberStepper';

/** Progression rules; the "double the jump" rule only applies to AMRAP plans. */
export function RulesEditor({ rules, onChange }: { rules: Rules; onChange(rules: Rules): void }) {
  const t = useTheme();
  const amrap = (rules.progression ?? 'amrap') === 'amrap';
  return (
    <View style={{ gap: t.space[8] }}>
      <ListRow
        title="Warm-up sets"
        accessory="switch"
        switchValue={rules.warmups}
        onSwitch={(warmups) => onChange({ ...rules, warmups })}
      />
      {amrap ? (
        <NumberStepper
          label="Double the jump at (reps)"
          value={rules.doubleAt}
          step={1}
          min={6}
          max={15}
          format={(v) => `${v}+`}
          onChange={(doubleAt) => onChange({ ...rules, doubleAt })}
        />
      ) : null}
      <NumberStepper
        label="Deload"
        value={Math.round(rules.deloadPct * 100)}
        step={5}
        min={5}
        max={20}
        format={(v) => `${v} %`}
        onChange={(v) => onChange({ ...rules, deloadPct: v / 100 })}
      />
      <NumberStepper
        label="Fails before deload"
        value={rules.failsBeforeDeload}
        step={1}
        min={0}
        max={3}
        format={String}
        onChange={(failsBeforeDeload) => onChange({ ...rules, failsBeforeDeload })}
      />
    </View>
  );
}
