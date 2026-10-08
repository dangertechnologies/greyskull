import type { Rules } from '../domain';
import { ListRow } from '../ui/ListRow';
import { NumberStepper } from '../ui/NumberStepper';
import { Section } from '../ui/Section';

/** Progression rules as settings rows; the "double the jump" rule only applies to AMRAP plans. */
export function RulesEditor({
  rules,
  onChange,
  card = false,
}: {
  rules: Rules;
  onChange(rules: Rules): void;
  /** On its own screen the rows sit on a card; inside the setup plan card they do not. */
  card?: boolean;
}) {
  const amrap = (rules.progression ?? 'amrap') === 'amrap';
  return (
    <Section card={card}>
      <ListRow
        title="Warm-up sets"
        accessory="switch"
        switchValue={rules.warmups}
        onSwitch={(warmups) => onChange({ ...rules, warmups })}
      />
      {amrap ? (
        <NumberStepper
          inline
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
        inline
        label="Deload"
        value={Math.round(rules.deloadPct * 100)}
        step={5}
        min={5}
        max={20}
        format={(v) => `${v} %`}
        onChange={(v) => onChange({ ...rules, deloadPct: v / 100 })}
      />
      <NumberStepper
        inline
        label="Fails before deload"
        value={rules.failsBeforeDeload}
        step={1}
        min={0}
        max={3}
        format={String}
        onChange={(failsBeforeDeload) => onChange({ ...rules, failsBeforeDeload })}
      />
    </Section>
  );
}
