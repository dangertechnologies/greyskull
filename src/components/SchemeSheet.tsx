import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Scheme, SchemeMode } from '../domain';
import { buildScheme, isTimedMode, schemeParts, switchMode } from '../domain';
import { Button } from '../ui/Button';
import { NumberStepper } from '../ui/NumberStepper';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Sheet } from '../ui/Sheet';
import { Text } from '../ui/Text';

const REP_MODES: { value: SchemeMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'lastAmrap', label: 'Last AMRAP' },
  { value: 'allAmrap', label: 'All AMRAP' },
  { value: 'range', label: 'Range' },
];

const HOLD_MODES: { value: SchemeMode; label: string }[] = [
  { value: 'timed', label: 'Fixed hold' },
  { value: 'timedRange', label: 'Range' },
];

const DESCRIPTION: Record<SchemeMode, string> = {
  fixed: 'Every set has the same rep target.',
  lastAmrap: 'The last set is as many reps as you can; it drives the progression.',
  allAmrap: 'Every set is as many reps as you can.',
  range: 'Aim for the bottom of the range; add a rep each time until the top, then add weight.',
  timed: 'Every set is a hold of the same length.',
  timedRange: 'Aim for the shortest hold; add a few seconds each time until the longest.',
};

/** Edit a slot's sets and reps, or seconds for a hold. Keyed by slot so the controls restart from the slot's scheme. */
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
  const timed = isTimedMode(parts.mode);
  const unit = timed ? 's' : '';
  return (
    <Sheet visible onClose={onClose} title="Sets and reps">
      <View style={{ gap: t.space[6] }}>
        <SegmentedControl
          accessibilityLabel="Counted in"
          options={[
            { value: 'reps', label: 'Reps' },
            { value: 'seconds', label: 'Seconds' },
          ]}
          value={timed ? 'seconds' : 'reps'}
          onChange={(v) => setParts((p) => switchMode(p, v === 'seconds' ? 'timed' : 'fixed'))}
        />
        <SegmentedControl
          accessibilityLabel="Scheme type"
          options={timed ? HOLD_MODES : REP_MODES}
          value={parts.mode}
          onChange={(mode) => setParts((p) => switchMode(p, mode as SchemeMode))}
        />
        <Text variant="callout" color="textMuted">
          {DESCRIPTION[parts.mode]}
        </Text>
        <NumberStepper
          label="Sets"
          value={parts.sets}
          step={1}
          min={1}
          max={20}
          format={String}
          onChange={(sets) => setParts((p) => ({ ...p, sets }))}
        />
        {parts.mode !== 'allAmrap' ? (
          <NumberStepper
            label={
              parts.mode === 'range' || parts.mode === 'timedRange' ? 'From' : timed ? 'Seconds' : 'Reps'
            }
            value={parts.reps}
            step={timed ? 5 : 1}
            min={timed ? 5 : 1}
            max={timed ? 300 : 30}
            format={(v) => `${v}${unit}`}
            onChange={(reps) => setParts((p) => ({ ...p, reps, repsMax: Math.max(p.repsMax, reps) }))}
          />
        ) : null}
        {parts.mode === 'range' || parts.mode === 'timedRange' ? (
          <NumberStepper
            label="To"
            value={Math.max(parts.repsMax, parts.reps)}
            step={timed ? 5 : 1}
            min={parts.reps}
            max={timed ? 600 : 40}
            format={(v) => `${v}${unit}`}
            onChange={(repsMax) => setParts((p) => ({ ...p, repsMax }))}
          />
        ) : null}
        <Button title="Save" onPress={() => onSave(buildScheme(parts))} />
      </View>
    </Sheet>
  );
}
