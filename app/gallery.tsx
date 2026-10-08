import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { builtInExercises } from '../src/catalog';
import { ThemeProvider, useTheme } from '../src/design/theme';
import type { Scheme } from '../src/design/tokens';
import { palettes, TYPE_VARIANTS } from '../src/design/tokens';
import { useInventory } from '../src/store';
import { Button } from '../src/ui/Button';
import { Chip } from '../src/ui/Chip';
import { EmptyState } from '../src/ui/EmptyState';
import { ExerciseBadge } from '../src/ui/ExerciseBadge';
import { Icon } from '../src/ui/Icon';
import { IconButton } from '../src/ui/IconButton';
import { ICON_NAMES, type IconName } from '../src/ui/icons';
import { ListRow } from '../src/ui/ListRow';
import { NumberStepper } from '../src/ui/NumberStepper';
import { PlateStack } from '../src/ui/PlateStack';
import { Section } from '../src/ui/Section';
import { SegmentedControl } from '../src/ui/SegmentedControl';
import { Card } from '../src/ui/Surface';
import { Text } from '../src/ui/Text';
import { TextField } from '../src/ui/TextField';

function Panel({ scheme }: { scheme: Scheme }) {
  return (
    <ThemeProvider forceScheme={scheme}>
      <PanelBody scheme={scheme} />
    </ThemeProvider>
  );
}

function PanelBody({ scheme }: { scheme: Scheme }) {
  const t = useTheme();
  const [reps, setReps] = useState(5);
  const [seg, setSeg] = useState('a');
  const [chip, setChip] = useState(true);
  const exercises = Object.values(builtInExercises());
  const inventory = useInventory();
  return (
    <View style={{ backgroundColor: t.color.background, padding: t.space[5], gap: t.space[10] }}>
      <Text variant="title" accessibilityRole="header">{`${scheme} theme`}</Text>

      <Section label="Colour roles">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
          {Object.entries(palettes[scheme]).map(([role, value]) => (
            <View key={role} style={{ alignItems: 'center', gap: t.space[1] }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: t.radius.md,
                  backgroundColor: value,
                  borderWidth: 1,
                  borderColor: t.color.borderStrong,
                }}
              />
              <Text variant="caption" color="textMuted">
                {role}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section label="Type scale">
        <View style={{ gap: t.space[3] }}>
          {TYPE_VARIANTS.map((v) => (
            <Text key={v} variant={v}>
              {v === 'display' ? '62.5 kg' : v === 'numberLarge' ? '12 reps' : `${v}: Greyskull`}
            </Text>
          ))}
        </View>
      </Section>

      <Section label="Buttons">
        <Button title="Start workout" size="lg" onPress={() => undefined} />
        <Button title="Primary" onPress={() => undefined} />
        <Button title="Secondary" variant="secondary" onPress={() => undefined} />
        <Button title="Plain" variant="plain" onPress={() => undefined} />
        <Button title="Destructive" variant="destructive" onPress={() => undefined} />
        <Button title="Disabled" disabled onPress={() => undefined} />
      </Section>

      <Section label="Controls">
        <SegmentedControl
          accessibilityLabel="Gallery segments"
          options={[
            { value: 'a', label: 'System' },
            { value: 'b', label: 'Light' },
            { value: 'c', label: 'Dark' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <Chip label="2.5" role="checkbox" selected={chip} onPress={() => setChip((c) => !c)} />
          <Chip label="5" role="checkbox" selected={!chip} onPress={() => setChip((c) => !c)} />
        </View>
        <NumberStepper
          label="Reps"
          size="lg"
          value={reps}
          step={1}
          min={1}
          format={String}
          onChange={setReps}
        />
        <TextField label="Name" placeholder="Front squat" />
      </Section>

      <Section label="Rows and cards">
        <Card>
          <ListRow
            title="Minimalist view"
            subtitle="All sets on one page"
            accessory="switch"
            switchValue
            onSwitch={() => undefined}
          />
          <ListRow title="Progression rules" accessory="chevron" onPress={() => undefined} />
          <ListRow title="Reset" destructive onPress={() => undefined} />
        </Card>
      </Section>

      <Section label="Exercise badges">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
          {exercises.map((e) => (
            <ExerciseBadge key={e.id} exercise={e} />
          ))}
        </View>
      </Section>

      <Section label="Plates">
        <PlateStack kg={102.5} unit="kg" inventory={inventory} />
        <PlateStack kg={62.9} unit="lb" inventory={inventory} size="sm" />
      </Section>

      <Section label="Icons">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[4] }}>
          {(Object.keys(ICON_NAMES) as IconName[]).map((name) => (
            <Icon key={name} name={name} />
          ))}
          <IconButton icon="add" label="Add" onPress={() => undefined} />
        </View>
      </Section>

      <EmptyState
        icon="progress"
        title="Nothing here yet"
        body="An empty state with an action."
        action={{ title: 'Do something', onPress: () => undefined }}
      />
    </View>
  );
}

/** Dev-only: every primitive in both schemes. Open from Settings → Developer. */
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryScroll />;
}

function GalleryScroll() {
  return (
    <ScrollView>
      <Stack.Screen options={{ title: 'Design gallery' }} />
      <Panel scheme="dark" />
      <Panel scheme="light" />
    </ScrollView>
  );
}
