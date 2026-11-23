import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Day, Group, GroupKind, GroupSettings, Program, Slot } from '../domain';
import {
  addAlternatingSlot,
  addDay,
  addExercise,
  addSlot,
  canGroup,
  defaultGroupSettings,
  exerciseIdsOf,
  GROUP_LABELS,
  getLadder,
  groupLabel,
  groupSlots,
  moveSlot,
  moveSlotTo,
  removeDay,
  removeSlot,
  renameDay,
  setSlotLadder,
  setSlotProgression,
  setSlotScheme,
  ungroup,
  updateGroup,
} from '../domain';
import { nameOf, schemeLabel } from '../format';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { ExerciseBadge } from '../ui/ExerciseBadge';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Card } from '../ui/Surface';
import { Text } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { GroupSheet } from './builder/GroupSheet';
import { LadderSheet } from './builder/LadderSheet';
import { ProgressionPanel, progressionLabel } from './builder/ProgressionPanel';
import { ExercisePicker } from './ExercisePicker';
import { SchemeSheet } from './SchemeSheet';
import { SlotRow } from './SlotRow';

type Picking = { day: number; mode: 'single' | 'pair'; first?: string } | null;
type Cell = { day: number; slot: number };
type GroupDraft =
  | { day: number; kind: GroupKind; indices: number[] }
  | { day: number; groupId: string; kind: GroupKind; count: number };
type Block = { kind: 'slot'; i: number } | { kind: 'group'; group: Group; indices: number[] };

const KINDS: GroupKind[] = ['superset', 'circuit', 'emom', 'interval'];
const idsOf = (slot: Slot): string[] => (typeof slot.exercise === 'string' ? [slot.exercise] : slot.exercise);

/** Slots in order, with the members of a group collected into one block. */
function blocksOf(day: Day): Block[] {
  const out: Block[] = [];
  for (const [i, slot] of day.slots.entries()) {
    const group = slot.group === undefined ? undefined : day.groups?.find((g) => g.id === slot.group);
    if (!group) {
      out.push({ kind: 'slot', i });
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === 'group' && last.group.id === group.id) last.indices.push(i);
    else out.push({ kind: 'group', group, indices: [i] });
  }
  return out;
}

function SelectBox({ checked, label, onPress }: { checked: boolean; label: string; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={4}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: t.radius.sm,
          borderWidth: 2,
          borderColor: checked ? t.color.accent : t.color.borderStrong,
          backgroundColor: checked ? t.color.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={16} color="onAccent" /> : null}
      </View>
    </Pressable>
  );
}

/**
 * The days of a program: add, remove, reorder and rename exercises, set each one's sets, reps or seconds and its
 * progression (including ladders), and group neighbouring exercises into supersets, circuits, EMOMs and
 * intervals. `errors` (from `validateProgram`) are shown under the day they belong to.
 */
export function DaysEditor({
  program,
  onChange,
  errors,
}: {
  program: Program;
  onChange(program: Program): void;
  errors: string[];
}) {
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const [picking, setPicking] = useState<Picking>(null);
  const [schemeFor, setSchemeFor] = useState<Cell | null>(null);
  const [ladderFor, setLadderFor] = useState<Cell | null>(null);
  const [progOpen, setProgOpen] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<{ day: number; picked: number[] } | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);

  const onPick = (id: string) => {
    if (!picking) return;
    if (picking.mode === 'single') {
      onChange(
        exercises[id] ? addExercise(program, picking.day, exercises[id]) : addSlot(program, picking.day, id),
      );
      setPicking(null);
    } else if (!picking.first) {
      setPicking({ ...picking, first: id });
    } else {
      onChange(addAlternatingSlot(program, picking.day, picking.first, id));
      setPicking(null);
    }
  };
  const dayIds = picking ? exerciseIdsOf({ ...program, days: [program.days[picking.day]] }) : [];

  // Each message goes under the first day it names; the rest (program-wide) go at the bottom.
  const byDay = program.days.map(() => [] as string[]);
  const general: string[] = [];
  for (const e of errors) {
    const d = program.days.findIndex(
      (day) => e.startsWith(`${day.name}:`) || e.startsWith(`${day.name} has no`),
    );
    (d >= 0 ? byDay[d] : general).push(e);
  }

  // Open panels and the selection are by position, so any reordering closes them.
  const reorder = (next: Program) => {
    setProgOpen(null);
    setSelecting(null);
    onChange(next);
  };

  const renderSlot = (d: number, i: number, label?: string) => {
    const day = program.days[d];
    const slot = day.slots[i];
    const ids = idsOf(slot);
    const ladder = slot.ladder === undefined ? undefined : getLadder(slot.ladder);
    const title = ladder ? ladder.name : ids.map((id) => nameOf(exercises, id, ids.length > 1)).join(' / ');
    const first = exercises[ids[0]];
    const key = `${d}:${i}`;
    const open = progOpen === key;
    const inGroup = slot.group !== undefined;
    const selectable = selecting?.day === d && !inGroup;
    const prev = day.slots[i - 1];
    const next = day.slots[i + 1];
    const model = progressionLabel(slot, program.rules);
    const body = (
      <>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[3],
            paddingRight: inGroup || day.groups ? 0 : 36,
          }}
        >
          {selectable ? (
            <SelectBox
              label={`Select ${title}`}
              checked={selecting.picked.includes(i)}
              onPress={() =>
                setSelecting({
                  day: d,
                  picked: (selecting.picked.includes(i)
                    ? selecting.picked.filter((x) => x !== i)
                    : [...selecting.picked, i]
                  ).sort((a, b) => a - b),
                })
              }
            />
          ) : null}
          {label ? (
            <View
              style={{
                borderRadius: t.radius.pill,
                backgroundColor: t.color.chartFill,
                paddingHorizontal: t.space[3],
                paddingVertical: t.space[1],
              }}
            >
              <Text variant="bodyStrong" color="accent">
                {label}
              </Text>
            </View>
          ) : first ? (
            <ExerciseBadge exercise={first} size={40} />
          ) : null}
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1] }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Button
              title={schemeLabel(slot.scheme)}
              variant="secondary"
              accessibilityLabel={`Scheme ${slot.scheme}, tap to change`}
              onPress={() => setSchemeFor({ day: d, slot: i })}
            />
          </View>
          <IconButton
            icon="up"
            label="Move up"
            disabled={i === 0 || (inGroup && prev?.group !== slot.group)}
            onPress={() => reorder(moveSlot(program, d, i, -1))}
          />
          <IconButton
            icon="down"
            label="Move down"
            disabled={i === day.slots.length - 1 || (inGroup && next?.group !== slot.group)}
            onPress={() => reorder(moveSlot(program, d, i, 1))}
          />
          <IconButton
            icon="close"
            label="Remove exercise"
            tone="danger"
            onPress={() => {
              setProgOpen(null);
              setSelecting(null);
              onChange(removeSlot(program, d, i));
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Progression of ${title}: ${model}, tap to ${open ? 'hide' : 'change'}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setProgOpen(open ? null : key)}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}
        >
          <Text variant="callout" color="textMuted">
            Progression
          </Text>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {model}
          </Text>
          <Icon name={open ? 'up' : 'down'} size={14} color="textMuted" />
        </Pressable>
        {open ? (
          <ProgressionPanel
            slot={slot}
            rules={program.rules}
            exercises={exercises}
            onModel={(m) => onChange(setSlotProgression(program, d, i, m, exercises))}
            onLadder={() => setLadderFor({ day: d, slot: i })}
          />
        ) : null}
      </>
    );
    if (inGroup)
      return (
        <View
          key={key}
          style={{
            gap: t.space[3],
            padding: t.space[4],
            borderRadius: t.radius.lg,
            backgroundColor: t.color.surfaceRaised,
          }}
        >
          {body}
        </View>
      );
    // Dragging needs equal row heights, which grouped days do not have: they reorder with the arrows.
    return day.groups?.length ? (
      <View key={key} style={{ gap: t.space[3] }}>
        {body}
      </View>
    ) : (
      <SlotRow
        key={key}
        index={i}
        count={day.slots.length}
        handleLabel={`Reorder ${title}`}
        onDrop={(to) => reorder(moveSlotTo(program, d, i, to))}
      >
        {body}
      </SlotRow>
    );
  };

  const renderBlock = (d: number, block: Block) => {
    if (block.kind === 'slot') return renderSlot(d, block.i);
    const day = program.days[d];
    const letter = String.fromCharCode(
      65 +
        Math.max(
          0,
          (day.groups ?? []).findIndex((g) => g.id === block.group.id),
        ),
    );
    return (
      <View
        key={`g-${block.group.id}-${block.indices[0]}`}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: t.color.accent,
          paddingLeft: t.space[3],
          gap: t.space[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space[2] }}>
          <Text variant="label" color="accent" style={{ flex: 1 }}>
            {groupLabel(block.group).toUpperCase()}
          </Text>
          <Button
            title="Edit"
            variant="plain"
            accessibilityLabel={`Edit ${GROUP_LABELS[block.group.kind]} ${letter}`}
            onPress={() =>
              setGroupDraft({
                day: d,
                groupId: block.group.id,
                kind: block.group.kind,
                count: block.indices.length,
              })
            }
          />
          <Button
            title="Ungroup"
            variant="plain"
            accessibilityLabel={`Ungroup ${GROUP_LABELS[block.group.kind]} ${letter}`}
            onPress={() => onChange(ungroup(program, d, block.group.id))}
          />
        </View>
        {block.indices.map((i, k) => renderSlot(d, i, `${letter}${k + 1}`))}
      </View>
    );
  };

  const sheetSlot = schemeFor ? program.days[schemeFor.day]?.slots[schemeFor.slot] : undefined;
  const draftGroup =
    groupDraft && 'groupId' in groupDraft
      ? program.days[groupDraft.day]?.groups?.find((g) => g.id === groupDraft.groupId)
      : undefined;
  const draftCount = groupDraft
    ? 'indices' in groupDraft
      ? groupDraft.indices.length
      : groupDraft.count
    : 0;

  return (
    <>
      <View style={{ gap: t.space[6] }}>
        {program.days.map((day, d) => {
          const picked = selecting?.day === d ? selecting.picked : null;
          const reason = picked ? canGroup(day, picked, 'emom') : null;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: days are edited by position and have no id
            <Card key={d} style={{ gap: t.space[5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space[2] }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={`Name of day ${d + 1}`}
                    value={day.name}
                    onChangeText={(name) => onChange(renameDay(program, d, name))}
                  />
                </View>
                <IconButton
                  icon="delete"
                  label={`Remove ${day.name}`}
                  tone="danger"
                  onPress={() => {
                    setProgOpen(null);
                    setSelecting(null);
                    onChange(removeDay(program, d));
                  }}
                />
              </View>

              {blocksOf(day).map((block) => renderBlock(d, block))}

              {byDay[d].map((e) => (
                <Text key={e} variant="callout" color="danger">
                  {e}
                </Text>
              ))}

              {picked ? (
                <View style={{ gap: t.space[3] }}>
                  <Text variant="callout" color="textMuted" accessibilityLiveRegion="polite">
                    {reason ?? `${picked.length} selected. Superset and Circuit need at least two.`}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
                    {KINDS.map((kind) => (
                      <Button
                        key={kind}
                        title={GROUP_LABELS[kind]}
                        variant="secondary"
                        disabled={canGroup(day, picked, kind) !== null}
                        onPress={() => setGroupDraft({ day: d, kind, indices: picked })}
                      />
                    ))}
                  </View>
                  <Button title="Cancel grouping" variant="plain" onPress={() => setSelecting(null)} />
                </View>
              ) : (
                <View style={{ gap: t.space[2] }}>
                  <Button
                    title="Add exercise"
                    variant="secondary"
                    onPress={() => setPicking({ day: d, mode: 'single' })}
                  />
                  <Button
                    title="Add alternating pair"
                    variant="plain"
                    onPress={() => setPicking({ day: d, mode: 'pair' })}
                  />
                  {day.slots.length > 0 ? (
                    <Button
                      title="Group exercises"
                      variant="plain"
                      accessibilityHint="Choose neighbouring exercises for a superset, circuit, EMOM or interval"
                      onPress={() => {
                        setProgOpen(null);
                        setSelecting({ day: d, picked: [] });
                      }}
                    />
                  ) : null}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <View style={{ height: t.space[2] }} />
      <Button title="Add day" variant="secondary" onPress={() => onChange(addDay(program))} />
      {general.map((e) => (
        <Text key={e} variant="callout" color="danger">
          {e}
        </Text>
      ))}

      <ExercisePicker
        visible={picking !== null}
        title={
          picking?.mode === 'pair'
            ? picking.first
              ? 'Alternate with…'
              : 'First exercise of the pair'
            : 'Choose an exercise'
        }
        exercises={exercises}
        exclude={picking?.first ? [...dayIds, picking.first] : dayIds}
        onPick={onPick}
        onClose={() => setPicking(null)}
      />

      {schemeFor && sheetSlot ? (
        <SchemeSheet
          scheme={sheetSlot.scheme}
          onClose={() => setSchemeFor(null)}
          onSave={(scheme) => {
            onChange(setSlotScheme(program, schemeFor.day, schemeFor.slot, scheme));
            setSchemeFor(null);
          }}
        />
      ) : null}

      {ladderFor ? (
        <LadderSheet
          selected={program.days[ladderFor.day]?.slots[ladderFor.slot]?.ladder}
          exercises={exercises}
          onClose={() => setLadderFor(null)}
          onPick={(id) => {
            onChange(setSlotLadder(program, ladderFor.day, ladderFor.slot, id));
            setLadderFor(null);
          }}
        />
      ) : null}

      {groupDraft && (!('groupId' in groupDraft) || draftGroup) ? (
        <GroupSheet
          kind={groupDraft.kind}
          count={draftCount}
          initial={draftGroup ?? defaultGroupSettings(groupDraft.kind, draftCount)}
          confirm={'groupId' in groupDraft ? 'Save' : `Make ${GROUP_LABELS[groupDraft.kind]}`}
          onClose={() => setGroupDraft(null)}
          onSave={(settings: GroupSettings) => {
            onChange(
              'groupId' in groupDraft
                ? updateGroup(program, groupDraft.day, groupDraft.groupId, settings)
                : groupSlots(program, groupDraft.day, groupDraft.indices, groupDraft.kind, settings),
            );
            setGroupDraft(null);
            setSelecting(null);
          }}
        />
      ) : null}
    </>
  );
}
