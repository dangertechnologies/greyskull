import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Celebration, type CelebrationLine } from '../../src/components/Celebration';
import { formatWeight, project, sessionFor } from '../../src/domain';
import { nameOf } from '../../src/format';
import type { FinishedExercise } from '../../src/hooks/useSession';
import { useSession } from '../../src/hooks/useSession';
import { goBackOr, goHome } from '../../src/navigation';
import { useStore } from '../../src/store';
import { SessionImmersive } from '../../src/views/SessionImmersive';
import { SessionMinimal } from '../../src/views/SessionMinimal';

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
  const [summary, setSummary] = useState<{ finished: FinishedExercise[]; programId?: string } | null>(null);

  if (summary) {
    const lines: CelebrationLine[] = summary.finished.flatMap((f) =>
      exercises[f.exerciseId]
        ? [{ exercise: exercises[f.exerciseId], fromKg: f.fromKg, outcome: f.outcome, pr: f.pr }]
        : [],
    );
    const state = useStore.getState();
    const program = state.programs.find((p) => p.id === summary.programId);
    const next = program ? sessionFor(program) : null;
    const projected = program ? project(state, program.id, 1)[0] : undefined;
    const nextUp = next
      ? `${next.dayName} · ${next.slots
          .map(({ exercise: id }) =>
            exercises[id]?.kind === 'bodyweight'
              ? nameOf(exercises, id, true)
              : `${nameOf(exercises, id, true)} ${formatWeight(projected?.lifts.find((l) => l.exercise === id)?.weightKg ?? 0, unit)}`,
          )
          .join(' · ')}`
      : undefined;
    return <Celebration lines={lines} unit={unit} nextUp={nextUp} onHome={goHome} />;
  }
  // One workout at a time: another open workout is shown instead; without one only the next id can start.
  if (draftN !== null && draftN !== n) return <Redirect href={`/session/${draftN}`} />;
  if (draftN === null && (n !== nextSession || !params.program)) return <Redirect href="/" />;
  if (!session) return null;

  const Session = minimalist ? SessionMinimal : SessionImmersive;
  return (
    <Session
      session={session}
      onBack={() => goBackOr('/')}
      onFinish={() => setSummary({ finished: session.finish(), programId: session.draft.programId })}
    />
  );
}
