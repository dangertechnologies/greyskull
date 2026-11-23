import { router } from 'expo-router';
import { View } from 'react-native';
import { CategoryPill, Pill, ProgramBadge } from '../../src/components/ProgramBits';
import { useTheme } from '../../src/design/theme';
import type { ActiveProgram, CustomPlan } from '../../src/domain';
import { sessionFor } from '../../src/domain';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { ExerciseBadge } from '../../src/ui/ExerciseBadge';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { Text } from '../../src/ui/Text';

function ProgramRow({ program }: { program: ActiveProgram }) {
  const t = useTheme();
  const draft = useStore((s) => s.draft);
  const day = sessionFor(program).dayName;
  const subtitle = program.paused
    ? `Paused · ${day} next`
    : `${day} next · ${program.sessionsPerWeek} a week`;
  return (
    <ListRow
      title={program.name}
      subtitle={subtitle}
      leading={<ProgramBadge program={program} />}
      accessibilityLabel={`${program.name}, ${subtitle}${draft?.programId === program.id ? ', workout open' : ''}`}
      onPress={() => router.push(`/program/${program.id}`)}
      accessory={
        <View style={{ alignItems: 'flex-end', gap: t.space[1] }}>
          <CategoryPill program={program} />
          {draft?.programId === program.id ? (
            <Pill label="Draft open" tone="warning" />
          ) : program.paused ? null : (
            <Pill label="Active" tone="success" />
          )}
        </View>
      }
    />
  );
}

function CustomPlanRow({ plan }: { plan: CustomPlan }) {
  const exercises = useStore((s) => s.exercises);
  const first = plan.program.days[0]?.slots[0]?.exercise;
  const exercise = exercises[Array.isArray(first) ? first[0] : (first ?? '')];
  return (
    <ListRow
      title={plan.name}
      subtitle={plan.summary ?? `${plan.program.days.length} days`}
      leading={exercise ? <ExerciseBadge exercise={exercise} size={40} /> : undefined}
      accessory="chevron"
      onPress={() => router.push(`/setup/plan?add=1&pick=${plan.id}`)}
    />
  );
}

export default function Programs() {
  const programs = useStore((s) => s.programs);
  const customPlans = useStore((s) => s.customPlans);
  const active = programs.filter((p) => !p.paused);
  const paused = programs.filter((p) => p.paused);

  return (
    <ScreenScroll headerless gap={10}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
          Programs
        </Text>
        <View style={{ minWidth: 120 }}>
          <Button
            title="New"
            variant="secondary"
            icon="add"
            testID="new-program"
            accessibilityLabel="Add a program"
            onPress={() => router.push('/setup/plan?add=1')}
          />
        </View>
      </View>

      {programs.length === 0 ? (
        <EmptyState
          icon="plan"
          title="No program yet"
          body="Add a program to see its workouts on Today."
          action={{ title: 'Add a program', onPress: () => router.push('/setup/plan?add=1') }}
        />
      ) : null}

      {active.length > 0 ? (
        <Section label="Active" card>
          {active.map((p) => (
            <ProgramRow key={p.id} program={p} />
          ))}
        </Section>
      ) : null}
      {paused.length > 0 ? (
        <Section label="Paused" card>
          {paused.map((p) => (
            <ProgramRow key={p.id} program={p} />
          ))}
        </Section>
      ) : null}
      {customPlans.length > 0 ? (
        <Section label="My programs" footer="Saved programs you can add again." card>
          {customPlans.map((c) => (
            <CustomPlanRow key={c.id} plan={c} />
          ))}
        </Section>
      ) : null}
    </ScreenScroll>
  );
}
