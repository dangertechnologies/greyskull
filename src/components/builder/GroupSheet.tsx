import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../design/theme';
import type { GroupKind, GroupSettings } from '../../domain';
import { GROUP_LABELS, snapMinutes } from '../../domain';
import { Button } from '../../ui/Button';
import { NumberStepper } from '../../ui/NumberStepper';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';

const DESCRIPTION: Record<GroupKind, string> = {
  superset: 'Do one set of each exercise in turn, then rest.',
  circuit: 'Go through the exercises for a set number of rounds, resting after each round.',
  emom: 'Every minute on the minute, start the next exercise. Minutes must divide evenly by the exercises.',
  interval: 'Work for a set time, then rest, for a set number of rounds.',
};

const seconds = (v: number) => `${v} s`;

/** Rounds, rest, work time and minutes of a group. Only the settings the kind uses are shown. */
export function GroupSheet({
  kind,
  count,
  initial,
  confirm,
  onSave,
  onClose,
}: {
  kind: GroupKind;
  /** How many exercises are in the group; an EMOM steps its minutes by this. */
  count: number;
  initial: GroupSettings;
  confirm: string;
  onSave(settings: GroupSettings): void;
  onClose(): void;
}) {
  const t = useTheme();
  const [s, setS] = useState(initial);
  const patch = (p: GroupSettings) => setS((x) => ({ ...x, ...p }));
  return (
    <Sheet visible onClose={onClose} title={GROUP_LABELS[kind]}>
      <View style={{ gap: t.space[5] }}>
        <Text variant="callout" color="textMuted">
          {DESCRIPTION[kind]}
        </Text>
        {kind === 'circuit' || kind === 'interval' ? (
          <NumberStepper
            label="Rounds"
            value={s.rounds ?? 3}
            step={1}
            min={1}
            max={20}
            format={String}
            onChange={(rounds) => patch({ rounds })}
          />
        ) : null}
        {kind === 'emom' ? (
          <NumberStepper
            label="Minutes"
            value={snapMinutes(s.minutes ?? count, count)}
            step={count}
            min={count}
            max={Math.max(60, count)}
            format={(v) => `${v} min`}
            onChange={(minutes) => patch({ minutes })}
          />
        ) : null}
        {kind === 'interval' ? (
          <NumberStepper
            label="Work"
            value={s.workS ?? 30}
            step={5}
            min={5}
            max={600}
            format={seconds}
            onChange={(workS) => patch({ workS })}
          />
        ) : null}
        {kind !== 'emom' ? (
          <NumberStepper
            label={kind === 'interval' ? 'Rest after each set' : 'Rest after each round'}
            value={s.restS ?? 0}
            step={kind === 'interval' ? 5 : 15}
            min={0}
            max={600}
            format={seconds}
            onChange={(restS) => patch({ restS })}
          />
        ) : null}
        <Button title={confirm} onPress={() => onSave(s)} />
      </View>
    </Sheet>
  );
}
