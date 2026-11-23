import { router, Stack } from 'expo-router';
import { PLANS } from '../../src/config/plans';
import { useStore } from '../../src/store';
import { ListRow } from '../../src/ui/ListRow';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';

/** Where programs are made: start blank, copy a built-in plan, import a shared one, or edit one of yours. */
export default function BuilderHome() {
  const customPlans = useStore((s) => s.customPlans);
  return (
    <ScreenScroll gap={10}>
      <Stack.Screen options={{ title: 'Build a program' }} />
      <Section label="Create" card>
        <ListRow
          title="New program"
          subtitle="Start with one empty day"
          accessory="chevron"
          onPress={() => router.push('/builder/new')}
        />
        <ListRow
          title="Import a shared program"
          subtitle="Paste its text or choose its file"
          accessory="chevron"
          onPress={() => router.push('/builder/import')}
        />
      </Section>
      {customPlans.length > 0 ? (
        <Section label="My programs" card>
          {customPlans.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={
                p.summary ?? `${p.program.days.length} ${p.program.days.length === 1 ? 'day' : 'days'}`
              }
              accessory="chevron"
              onPress={() => router.push(`/builder/${p.id}`)}
            />
          ))}
        </Section>
      ) : null}
      <Section
        label="Copy a built-in plan"
        footer="The copy is yours to change; the built-in plan stays as it is."
        card
      >
        {PLANS.map((p) => (
          <ListRow
            key={p.id}
            title={p.name}
            subtitle={p.summary}
            accessory="chevron"
            onPress={() => router.push(`/builder/new?plan=${p.id}`)}
          />
        ))}
      </Section>
    </ScreenScroll>
  );
}
