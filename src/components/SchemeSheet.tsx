import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Scheme, SchemeMode } from '../domain';
import { buildScheme, schemeParts } from '../domain';
import { Button } from '../ui/Button';
import { NumberStepper } from '../ui/NumberStepper';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Sheet } from '../ui/Sheet';
import { Text } from '../ui/Text';

const MODES: { value: SchemeMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'lastAmrap', label: 'Last AMRAP' },
  { value: 'allAmrap', label: 'All AMRAP' },
  { value: 'range', label: 'Range' },
];

const DESCRIPTION: Record<SchemeMode, string> = {
  fixed: 'Every set has the same rep target.',
  lastAmrap: 'The last set is as many reps as you can; it drives the progression.',
  allAmrap: 'Every set is as many reps as you can.',
  range: 'Aim for the bottom of the range; add a rep each time until the top, then add weight.',
};

/** Edit a slot's sets and reps. Keyed by slot so the controls restart from the slot's scheme each time. */
export function SchemeSheet({
  scheme,
  onSave,
  onClose,
}: {
  scheme: Scheme;
  onSave(scheme: Scheme): void;
  onClose(): void;
}) {
  const t = useTheme();
  const [parts, setParts] = useState(() => schemeParts(scheme));
  return (
    <Sheet visible onClose={onClose} title="Sets and reps">
      <View style={{ gap: t.space[6] }}>
        <SegmentedControl
          accessibilityLabel="Scheme type"
          options={MODES}
          value={parts.mode}
          onChange={(mode) => setParts((p) => ({ ...p, mode: mode as SchemeMode }))}
        />
        <Text variant="callout" color="textMuted">
          {DESCRIPTION[parts.mode]}
        </Text>
        <NumberStepper
          label="Sets"
          value={parts.sets}
          step={1}
          min={1}
          max={8}
          format={String}
          onChange={(sets) => setParts((p) => ({ ...p, sets }))}
        />
        {parts.mode !== 'allAmrap' ? (
          <NumberStepper
            label={parts.mode === 'range' ? 'Reps from' : 'Reps'}
            value={parts.reps}
            step={1}
            min={1}
            max={30}
            format={String}
            onChange={(reps) => setParts((p) => ({ ...p, reps, repsMax: Math.max(p.repsMax, reps) }))}
          />
        ) : null}
        {parts.mode === 'range' ? (
          <NumberStepper
            label="Reps to"
            value={Math.max(parts.repsMax, parts.reps)}
            step={1}
            min={parts.reps}
            max={40}
            format={String}
            onChange={(repsMax) => setParts((p) => ({ ...p, repsMax }))}
          />
        ) : null}
        <Button title="Save" onPress={() => onSave(buildScheme(parts))} />
      </View>
    </Sheet>
  );
}
