import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { getPlan } from '../../src/config/plans';
import { useTheme } from '../../src/design/theme';
import { decodeAnswers, type Pick, recommend } from '../../src/generate/recommend';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

/** Opens the program picker with the plan chosen, the same way "My programs" does. */
const open = (planId: string) => router.push(`/setup/plan?add=1&pick=${planId}`);

function PlanRow({ pick }: { pick: Pick }) {
  const plan = getPlan(pick.planId);
  if (!plan) return null;
  return (
    <ListRow
      title={plan.name}
      subtitle={pick.reason}
      accessory="chevron"
      testID={`recommend-${plan.id}`}
      onPress={() => open(plan.id)}
    />
  );
}

export default function GenerateResults() {
  const { a } = useLocalSearchParams<{ a?: string }>();
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const answers = decodeAnswers(a);
  const { picks, addOn } = recommend(answers, exercises);

  return (
    <ScreenScroll gap={8}>
      <Stack.Screen options={{ title: 'Recommended' }} />
      {picks.length === 0 ? (
        <Text color="textMuted">
          No built-in program matches these answers. Describe what you want instead, or build your own.
        </Text>
      ) : (
        <Section
          label="Best match first"
          card
          footer="You can change the days and the rules before it starts."
        >
          {picks.map((p) => (
            <PlanRow key={p.planId} pick={p} />
          ))}
        </Section>
      )}
      {addOn ? (
        <Section label="Add beside it" card>
          <PlanRow pick={addOn} />
        </Section>
      ) : null}
      <View style={{ gap: t.space[2] }}>
        <Button
          title="Describe it instead"
          variant="secondary"
          onPress={() => router.push(`/generate/describe?a=${encodeURIComponent(a ?? '')}`)}
        />
        <Button title="Build my own" variant="plain" onPress={() => open('custom')} />
      </View>
    </ScreenScroll>
  );
}
