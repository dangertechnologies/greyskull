import { Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { CategoryPill, LoggedWorkout, Pill } from '../../src/components/ProgramBits';
import { useTheme } from '../../src/design/theme';
import type { ActiveProgram, SessionLog } from '../../src/domain';
import { sessionFor } from '../../src/domain';
import { nameOf, weekLabel } from '../../src/format';
import { useNow } from '../../src/hooks/useNow';
import { setCounts, startWorkout, WEIGHT_CONFIRM_ROUTE } from '../../src/programStart';
import { useStore } from '../../src/store';
import { Button } from '../../src/ui/Button';
import { EmptyState } from '../../src/ui/EmptyState';
import { ExerciseBadge } from '../../src/ui/ExerciseBadge';
import { ScreenScroll } from '../../src/ui/layout';
import { Section } from '../../src/ui/Section';
import { useSnackbar } from '../../src/ui/Snackbar';
import { Card } from '../../src/ui/Surface';
import { Text } from '../../src/ui/Text';

/** "Started 18 min ago" for a draft. */
function startedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Started just now';
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Started ${hours} h ago` : `Started ${Math.floor(hours / 24)} d ago`;
}

function DraftCard({ draft }: { draft: SessionLog }) {
  const t = useTheme();
  const now = useNow();
  // The program's current name, so a rename shows; the name stored in the draft is for a removed program.
  const name = useStore((s) => s.programs.find((p) => p.id === draft.programId)?.name) ?? draft.programName;
  const { done, total } = setCounts(draft);
  return (
    <Card style={{ gap: t.space[4], borderWidth: 2, borderColor: t.color.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space[3] }}>
        <View style={{ flex: 1, gap: t.space[1] }}>
          <Text variant="headline">{`${name ?? 'Workout'} · ${draft.dayName}`}</Text>
          <Text variant="callout" color="textMuted">
            {`${startedAgo(draft.startedAt, now)} · ${done} of ${total} sets`}
          </Text>
        </View>
        <Pill label="Draft" tone="success" />
      </View>
      <Button
        title="Resume workout"
        size="lg"
        testID="resume-workout"
        onPress={() => router.push(`/session/${draft.n}`)}
      />
    </Card>
  );
}

function ProgramCard({ program, sameName }: { program: ActiveProgram; sameName: boolean }) {
  const t = useTheme();
  const exercises = useStore((s) => s.exercises);
  const snackbar = useSnackbar();
  const session = sessionFor(program);
  const ids = session.slots.map((s) => s.exercise).slice(0, 5);
  // Two cards with one name are told apart by their next day.
  const who = sameName ? `${program.name}, ${session.dayName}` : program.name;

  const skip = () => {
    useStore.getState().skipSession(program.id);
    snackbar.show({
      message: `${program.name}: workout skipped`,
      action: { label: 'Undo', onPress: () => useStore.getState().undoSkip(program.id) },
    });
  };

  return (
    <Card style={{ gap: t.space[4] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${program.name}, next ${session.dayName}, ${weekLabel(program)}`}
        accessibilityHint="Opens the program"
        onPress={() => router.push(`/program/${program.id}`)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space[3] }}
      >
        <View style={{ flex: 1, gap: t.space[1] }}>
          <Text variant="headline">{program.name}</Text>
          <Text variant="callout" color="textMuted">
            {`Next: ${session.dayName} · ${weekLabel(program)}`}
          </Text>
        </View>
        <CategoryPill program={program} />
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
        {ids.map((id) => exercises[id] && <ExerciseBadge key={id} exercise={exercises[id]} size={40} />)}
      </View>
      <Text variant="callout" color="textMuted">
        {ids.map((id) => nameOf(exercises, id, true)).join(' · ')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space[3] }}>
        <View
          style={{
            flexGrow: 1,
            flexBasis: 140,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.color.borderStrong,
          }}
        >
          <Button
            title="Start"
            variant="secondary"
            testID={`start-${program.id}`}
            accessibilityLabel={`Start ${who}`}
            onPress={() => startWorkout(program)}
          />
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button
            title="Skip"
            variant="plain"
            testID={`skip-${program.id}`}
            accessibilityLabel={`Skip ${who}`}
            onPress={skip}
          />
        </View>
      </View>
    </Card>
  );
}

function PausedCard({ program }: { program: ActiveProgram }) {
  const t = useTheme();
  const session = sessionFor(program);
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${program.name}, paused, ${session.dayName} next`}
        accessibilityHint="Opens the program"
        onPress={() => router.push(`/program/${program.id}`)}
        style={{ flex: 1, gap: t.space[1] }}
      >
        <Text variant="bodyStrong">{program.name}</Text>
        <Text variant="callout" color="textMuted">
          {`Paused · ${session.dayName} next`}
        </Text>
      </Pressable>
      <Button
        title="Resume"
        variant="plain"
        testID={`resume-${program.id}`}
        accessibilityLabel={`Resume ${program.name}`}
        onPress={() => useStore.getState().pauseProgram(program.id, false)}
      />
    </Card>
  );
}

export default function Today() {
  const programs = useStore((s) => s.programs);
  const draft = useStore((s) => s.draft);
  const sessions = useStore((s) => s.sessions);
  const needsWeightConfirm = useStore((s) => s.needsWeightConfirm);
  const t = useTheme();

  if (programs.length === 0 && sessions.length === 0) return <Redirect href="/setup" />;
  if (needsWeightConfirm) return <Redirect href={WEIGHT_CONFIRM_ROUTE} />;

  // The program with the open workout is shown by its draft card, not twice.
  const active = programs.filter((p) => !p.paused && p.id !== draft?.programId);
  // Never the program of the open workout: it has its draft card.
  const paused = programs.filter((p) => p.paused && p.id !== draft?.programId);
  const recent = [...sessions].reverse().slice(0, 3);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScreenScroll headerless gap={10}>
      <View style={{ gap: t.space[1] }}>
        <Text variant="label" color="textMuted">
          {date}
        </Text>
        <Text variant="title" accessibilityRole="header">
          Today
        </Text>
      </View>

      {programs.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No program yet"
          body="Pick a program and your first workout shows up here, with every weight worked out."
          action={{ title: 'Add a program', onPress: () => router.push('/setup/plan?add=1') }}
        />
      ) : null}

      {draft ? <DraftCard draft={draft} /> : null}
      {active.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          sameName={programs.some((q) => q.id !== p.id && q.name.toLowerCase() === p.name.toLowerCase())}
        />
      ))}
      {programs.length > 0 && active.length === 0 && !draft ? (
        <Text color="textMuted">All programs are paused. Resume one to see its next workout.</Text>
      ) : null}

      {paused.length > 0 ? (
        <Section label="Paused">
          <View style={{ gap: t.space[3] }}>
            {paused.map((p) => (
              <PausedCard key={p.id} program={p} />
            ))}
          </View>
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section label="Recent" card>
          {recent.map((log) => (
            <LoggedWorkout key={log.n} log={log} />
          ))}
          <Button title="See all history" variant="plain" onPress={() => router.push('/history')} />
        </Section>
      ) : null}
    </ScreenScroll>
  );
}
