import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../design/theme';
import type { Exercise, ProgressionChoice, Rules, Slot } from '../../domain';
import { effectiveModel, getLadder, progressionOptions, stuckReason } from '../../domain';
import { nameOf } from '../../format';
import { Icon } from '../../ui/Icon';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Text } from '../../ui/Text';

export const MODEL_LABEL: Record<ProgressionChoice, string> = {
  amrap: 'AMRAP',
  linear: 'Linear',
  double: 'Double',
  ladder: 'Ladder',
};

const MODEL_HELP: Record<ProgressionChoice, string> = {
  amrap: 'The last set is as many reps as you can; five or more adds weight.',
  linear: 'Add weight when every set is done.',
  double: 'Add a rep each time until the top of the range, then add weight.',
  ladder: 'Move to the next, harder exercise of the ladder when the top of the range is reached.',
};

/** The model name shown on a slot: its own, the program's, or the plan-wide rule when it is not one of the four. */
export function progressionLabel(slot: Slot, rules: Rules): string {
  const m = effectiveModel(slot, rules);
  return m in MODEL_LABEL ? MODEL_LABEL[m as ProgressionChoice] : m === '531' ? '5/3/1' : 'Stages';
}

/** The per-slot progression picker: AMRAP, Linear, Double or Ladder, with the reasons a choice is not offered. */
export function ProgressionPanel({
  slot,
  rules,
  exercises,
  onModel,
  onLadder,
}: {
  slot: Slot;
  rules: Rules;
  exercises: Record<string, Exercise>;
  onModel(model: Exclude<ProgressionChoice, 'ladder'>): void;
  /** Open the ladder list (a ladder is chosen there). */
  onLadder(): void;
}) {
  const t = useTheme();
  const [note, setNote] = useState<string | null>(null);
  const options = progressionOptions(slot, exercises);
  const model = effectiveModel(slot, rules);
  const current = model in MODEL_LABEL ? (model as ProgressionChoice) : '';
  const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
  const stuck = stuckReason(slot, rules, exercises);
  const blocked = options.filter((o) => o.disabled);
  return (
    <View style={{ gap: t.space[3] }}>
      <Text variant="label" color="textMuted">
        PROGRESSION
      </Text>
      <SegmentedControl
        accessibilityLabel="Progression"
        options={options.map((o) => ({ value: o.model, label: MODEL_LABEL[o.model] }))}
        value={current}
        onChange={(m) => {
          const option = options.find((o) => o.model === m);
          setNote(option?.disabled ?? null);
          if (!option || option.disabled) return;
          if (option.model === 'ladder') onLadder();
          else onModel(option.model);
        }}
      />
      {current === '' ? (
        <Text variant="callout" color="textMuted">
          {`This exercise follows the program's ${progressionLabel(slot, rules)} rule. Choose one to change it.`}
        </Text>
      ) : (
        <Text variant="callout" color="textMuted">
          {MODEL_HELP[current]}
        </Text>
      )}
      {current === 'ladder' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ladder: ${ladder?.name ?? 'none'}, tap to change`}
          onPress={onLadder}
          style={{
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[3],
            paddingHorizontal: t.space[4],
            borderRadius: t.radius.lg,
            borderWidth: 1.5,
            borderColor: t.color.borderStrong,
          }}
        >
          <Icon name="rules" size={20} color="accent" />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {ladder?.name ?? 'Choose a ladder'}
          </Text>
          <Icon name="down" size={14} color="textMuted" />
        </Pressable>
      ) : null}
      {ladder ? (
        <Text variant="callout" color="textMuted">
          {ladder.steps.map((s) => nameOf(exercises, s.exercise)).join(' › ')}
        </Text>
      ) : null}
      {note ? (
        <Text variant="callout" color="danger" accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : stuck ? (
        <Text variant="callout" color="warning" accessibilityLiveRegion="polite">
          {stuck}
        </Text>
      ) : blocked.length > 0 ? (
        <Text variant="callout" color="textMuted">
          {[...new Set(blocked.map((o) => o.disabled))].join(' ')}
        </Text>
      ) : null}
    </View>
  );
}
