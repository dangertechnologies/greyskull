import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Celebration, type CelebrationLine } from '../../src/components/Celebration';
import { getLadder, project, sessionFor } from '../../src/domain';
import { nameOf, weightLabel } from '../../src/format';
import type { FinishedExercise } from '../../src/hooks/useSession';
import { isTimerKind, useSession } from '../../src/hooks/useSession';
import { goBackOr, goHome } from '../../src/navigation';
import { startRoute } from '../../src/programStart';
import { useStore } from '../../src/store';
import { anchorOf, useTimers, useTimersHydrated } from '../../src/timers/store';
import { GroupTimer } from '../../src/views/GroupTimer';
import { ladderMove } from '../../src/views/ladder';
import { SessionImmersive } from '../../src/views/SessionImmersive';
import { SessionMinimal } from '../../src/views/SessionMinimal';

/** What a ladder lift's outcome changed (see `ladderMove`), and whether its sets were holds. */
function ladderLine(f: FinishedExercise): Pick<CelebrationLine, 'step' | 'band' | 'timed'> {
  const ladder = f.ladder ? getLadder(f.ladder) : undefined;
  const { bands, exercises } = useStore.getState();
  return {
    ...(f.timed ? { timed: true } : {}),
    ...(ladder ? ladderMove(f.from, f.outcome.next, ladder, bands, exercises) : {}),
  };
}

/** Session `n`: the workout in progress, or a new one of `?program=<id>` when `n` is the next session id. */
export default function SessionScreen() {
  const params = useLocalSearchParams<{ n: string; program?: string }>();
  const n = Number(params.n);
  const nextSession = useStore((s) => s.nextSession);
  const draftN = useStore((s) => s.draft?.n ?? null);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const minimalist = useStore((s) => s.minimalist);
  const session = useSession(n, params.program);
  const timersReady = useTimersHydrated();
  // An EMOM or interval block that has not ended takes the whole screen, in either session view.
  const shown = session?.items[session.selectedIndex]?.group;
  const timerEnded = useTimers((s) => (shown ? anchorOf(s, n, shown.id)?.endedAt !== undefined : false));
  const mustConfirm = useStore((s) => s.draft === null && startRoute(s, params.program).kind === 'confirm');
  const [summary, setSummary] = useState<{ finished: FinishedExercise[]; programId?: string } | null>(null);

  if (summary) {
    const state = useStore.getState();
    const lines: CelebrationLine[] = summary.finished.flatMap((f) =>
      exercises[f.exerciseId]
        ? [
            {
              exercise: exercises[f.exerciseId],
              fromKg: f.fromKg,
              outcome: f.outcome,
              pr: f.pr,
              ...ladderLine(f),
            },
          ]
        : [],
    );
    const program = state.programs.find((p) => p.id === summary.programId);
    const next = program ? sessionFor(program) : null;
    const projected = program ? project(state, program.id, 1)[0] : undefined;
    const nextUp = next
      ? `${next.dayName} · ${next.slots
          .map(
            ({ exercise: id }) =>
              `${nameOf(exercises, id, true)}${weightLabel(projected?.lifts.find((l) => l.exercise === id)?.weightKg ?? 0, exercises[id], unit)}`,
          )
          .join(' · ')}`
      : undefined;
    return <Celebration lines={lines} unit={unit} nextUp={nextUp} onHome={goHome} />;
  }
  if (mustConfirm) return <Redirect href={startRoute(useStore.getState(), params.program).route as never} />;
  // One workout at a time: another open workout is shown instead; without one only the next id can start.
  if (draftN !== null && draftN !== n) return <Redirect href={`/session/${draftN}`} />;
  if (draftN === null && (n !== nextSession || !params.program)) return <Redirect href="/" />;
  if (!session || !timersReady) return null;
  if (shown && isTimerKind(shown.kind) && !timerEnded)
    return <GroupTimer session={session} groupId={shown.id} onBack={() => goBackOr('/')} />;

  const Session = minimalist ? SessionMinimal : SessionImmersive;
  return (
    <Session
      session={session}
      onBack={() => goBackOr('/')}
      onFinish={() => setSummary({ finished: session.finish(), programId: session.draft.programId })}
    />
  );
}
