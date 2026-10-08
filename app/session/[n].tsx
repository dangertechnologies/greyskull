import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Celebration, type CelebrationLine } from '../../src/components/Celebration';
import { formatWeight, sessionFor } from '../../src/domain';
import { nameOf } from '../../src/format';
import type { FinishedExercise } from '../../src/hooks/useSession';
import { useSession } from '../../src/hooks/useSession';
import { goBackOr, goHome } from '../../src/navigation';
import { useStore } from '../../src/store';
import { SessionImmersive } from '../../src/views/SessionImmersive';
import { SessionMinimal } from '../../src/views/SessionMinimal';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ n: string }>();
  const n = Number(params.n);
  const nextSession = useStore((s) => s.nextSession);
  const hasDraft = useStore((s) => s.draft !== null);
  const exercises = useStore((s) => s.exercises);
  const unit = useStore((s) => s.unit);
  const minimalist = useStore((s) => s.minimalist);
  const session = useSession(n);
  const [summary, setSummary] = useState<FinishedExercise[] | null>(null);

  if (summary) {
    const lines: CelebrationLine[] = summary.flatMap((f) =>
      exercises[f.exerciseId]
        ? [{ exercise: exercises[f.exerciseId], fromKg: f.fromKg, outcome: f.outcome, pr: f.pr }]
        : [],
    );
    const { program, lifts, nextSession: upcoming } = useStore.getState();
    const next = program ? sessionFor(program, upcoming) : null;
    const nextUp = next
      ? `${next.dayName} · ${next.slots
          .map(({ exercise: id }) =>
            exercises[id]?.kind === 'bodyweight'
              ? nameOf(exercises, id, true)
              : `${nameOf(exercises, id, true)} ${formatWeight(lifts[id]?.weightKg ?? 0, unit)}`,
          )
          .join(' · ')}`
      : undefined;
    return <Celebration lines={lines} unit={unit} nextUp={nextUp} onHome={goHome} />;
  }
  if (!hasDraft && n !== nextSession) return <Redirect href="/" />;
  if (!session) return null;

  const Session = minimalist ? SessionMinimal : SessionImmersive;
  return (
    <Session session={session} onBack={() => goBackOr('/')} onFinish={() => setSummary(session.finish())} />
  );
}
