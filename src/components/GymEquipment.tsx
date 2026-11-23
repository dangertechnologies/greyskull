import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../design/theme';
import type { Equipment, PlateInventory, Unit } from '../domain';
import { DEFAULT_INVENTORY, trim } from '../domain';
import { EQUIPMENT_LABELS } from '../exerciseFilter';
import { useStore } from '../store';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ListRow } from '../ui/ListRow';
import { NumberStepper } from '../ui/NumberStepper';
import { Section } from '../ui/Section';
import { Sheet } from '../ui/Sheet';
import { Text } from '../ui/Text';

/** What the user can tick, in the order shown. `none` (bodyweight) is always available, so it is not listed. */
const CHECKLIST: Equipment[] = [
  'barbell',
  'ez-bar',
  'trap-bar',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bench',
  'pull-up-bar',
  'dip-bars',
  'rings',
  'parallettes',
  'bands',
  'box',
  'medicine-ball',
  'exercise-ball',
  'foam-roll',
];
const LABELS: Record<Equipment, string> = {
  ...EQUIPMENT_LABELS,
  barbell: 'Barbell and plates',
  bands: 'Resistance bands',
};

type Band = { id: string; label: string };

/**
 * A band id that was never used: lift states and past workouts refer to bands by id, so a deleted band's id must
 * not come back for a new one. The time makes it new, the random part separates two bands made in one tick.
 */
export function newBandId(bands: Band[]): string {
  const taken = new Set(bands.map((b) => b.id));
  for (;;) {
    const id = `band_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;
    if (!taken.has(id)) return id;
  }
}

/** "Band 1", "Band 2", … the first one no band is called already. */
export function defaultBandLabel(bands: Band[]): string {
  const used = new Set(bands.map((b) => b.label.trim().toLowerCase()));
  let n = 1;
  while (used.has(`band ${n}`)) n++;
  return `Band ${n}`;
}

/** Moves the band at `from` to `to` (both inside the list); returns a new list. */
export function moveBand(bands: Band[], from: number, to: number): Band[] {
  if (to < 0 || to >= bands.length || from === to) return bands;
  const next = [...bands];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space[4],
        minHeight: 56,
        backgroundColor: pressed ? t.color.border : 'transparent',
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: t.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: checked ? 0 : 2,
          borderColor: t.color.borderStrong,
          backgroundColor: checked ? t.color.accent : 'transparent',
        }}
      >
        {checked ? <Icon name="check" size={16} color="onAccent" /> : null}
      </View>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function BandRow({
  band,
  index,
  count,
  onRename,
  onMove,
  onDelete,
}: {
  band: Band;
  index: number;
  count: number;
  onRename(label: string): void;
  onMove(to: number): void;
  onDelete(): void;
}) {
  const t = useTheme();
  // The text box keeps what is typed, but only a name with letters in it reaches the settings.
  const [draft, setDraft] = useState(band.label);
  const name = band.label.trim() || `Band ${index + 1}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1], minHeight: 64 }}>
      <TextInput
        accessibilityLabel={`Band ${index + 1} name`}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          if (text.trim()) onRename(text.trim());
        }}
        onBlur={() => setDraft(band.label)}
        // Typing replaces the name ("Band 1" → "Red"), not appends to it.
        selectTextOnFocus
        placeholder="Name"
        placeholderTextColor={t.color.textMuted}
        maxFontSizeMultiplier={1.6}
        style={[t.type.bodyStrong, { flex: 1, minHeight: 56, color: t.color.text }]}
      />
      <IconButton
        icon="up"
        label={`Move ${name} up`}
        disabled={index === 0}
        onPress={() => onMove(index - 1)}
      />
      <IconButton
        icon="down"
        label={`Move ${name} down`}
        disabled={index === count - 1}
        onPress={() => onMove(index + 1)}
      />
      <IconButton icon="delete" label={`Delete ${name}`} tone="danger" onPress={onDelete} />
    </View>
  );
}

/**
 * What the user owns beyond plates: an equipment checklist, resistance bands (shown once ticked), kettlebell
 * sizes (shown once ticked) and the "ease back after a break" switch. Equipment, bands and the switch are
 * saved straight to the app's settings; kettlebell sizes are part of the gym inventory the caller holds.
 */
export function GymEquipment({
  unit,
  inventory,
  onInventoryChange,
}: {
  unit: Unit;
  inventory: PlateInventory;
  onInventoryChange(patch: Partial<PlateInventory>): void;
}) {
  const t = useTheme();
  const equipment = useStore((s) => s.equipment);
  const bands = useStore((s) => s.bands);
  const breakDeload = useStore((s) => s.breakDeload);
  const { setEquipment, setBands, setBreakDeload } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const [newSize, setNewSize] = useState(unit === 'kg' ? 10 : 25);

  const owned = unit === 'kg' ? inventory.kettlebellsKg : inventory.kettlebellsLb;
  const defaults = unit === 'kg' ? DEFAULT_INVENTORY.kettlebellsKg : DEFAULT_INVENTORY.kettlebellsLb;
  const sizes = [...new Set([...defaults, ...owned])].sort((a, b) => a - b);
  const setSizes = (list: number[]) =>
    onInventoryChange(
      unit === 'kg'
        ? { kettlebellsKg: [...list].sort((a, b) => a - b) }
        : { kettlebellsLb: [...list].sort((a, b) => a - b) },
    );

  const tick = (q: Equipment) =>
    setEquipment(equipment.includes(q) ? equipment.filter((x) => x !== q) : [...equipment, q]);
  const rename = (id: string, label: string) =>
    setBands(bands.map((b) => (b.id === id ? { ...b, label } : b)));
  const askDelete = (band: Band) =>
    Alert.alert(`Delete ${band.label.trim() || 'this band'}?`, 'Past workouts keep the band they used.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setBands(bands.filter((b) => b.id !== band.id)),
      },
    ]);

  return (
    <View style={{ gap: t.space[8] }}>
      <Section
        label="Equipment"
        footer="Tick what you have. The library and program picker use it to show what fits. Leave all unticked if you are not sure."
        card
      >
        {CHECKLIST.map((q) => (
          <CheckRow key={q} label={LABELS[q]} checked={equipment.includes(q)} onPress={() => tick(q)} />
        ))}
      </Section>

      {equipment.includes('bands') ? (
        <View style={{ gap: t.space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
              Resistance bands
            </Text>
            <Button
              title="Add band"
              variant="plain"
              onPress={() => setBands([...bands, { id: newBandId(bands), label: defaultBandLabel(bands) }])}
            />
          </View>
          {bands.length > 0 ? (
            <Section footer="Heaviest assistance first." card>
              {bands.map((b, i) => (
                <BandRow
                  key={b.id}
                  band={b}
                  index={i}
                  count={bands.length}
                  onRename={(label) => rename(b.id, label)}
                  onMove={(to) => setBands(moveBand(bands, i, to))}
                  onDelete={() => askDelete(b)}
                />
              ))}
            </Section>
          ) : (
            <Text color="textMuted">No bands yet. Add the ones you use for assisted pull-ups and dips.</Text>
          )}
        </View>
      ) : null}

      {equipment.includes('kettlebell') ? (
        <Section label="Kettlebells" card>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], paddingVertical: t.space[4] }}
          >
            {sizes.map((s) => (
              <Chip
                key={s}
                role="checkbox"
                label={`${trim(s)} ${unit}`}
                selected={owned.includes(s)}
                onPress={() => setSizes(owned.includes(s) ? owned.filter((x) => x !== s) : [...owned, s])}
              />
            ))}
            <Chip
              role="checkbox"
              label="+ Add"
              selected={false}
              onPress={() => {
                setNewSize(unit === 'kg' ? 10 : 25);
                setAdding(true);
              }}
            />
          </View>
        </Section>
      ) : null}

      <Section card>
        <ListRow
          title="Ease back after a break"
          subtitle="Lower your weights when you come back after a long break"
          accessory="switch"
          switchValue={breakDeload}
          onSwitch={setBreakDeload}
        />
      </Section>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a kettlebell">
        <NumberStepper
          label="Size"
          value={newSize}
          step={unit === 'kg' ? 2 : 5}
          min={unit === 'kg' ? 2 : 5}
          max={unit === 'kg' ? 80 : 180}
          format={(v) => `${trim(v)} ${unit}`}
          onChange={setNewSize}
        />
        <Button
          title="Add"
          size="lg"
          onPress={() => {
            setSizes([...new Set([...owned, newSize])]);
            setAdding(false);
          }}
        />
      </Sheet>
    </View>
  );
}
