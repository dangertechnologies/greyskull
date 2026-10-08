import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Celebration } from '../../src/components/Celebration';
import { nameOf, outcomeLine } from '../../src/format';
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
    const lines = summary
      .map((f) => outcomeLine(nameOf(exercises, f.exerciseId), f.fromKg, f.outcome, unit))
      .filter((l): l is string => l !== null);
    return <Celebration lines={lines} onHome={goHome} />;
  }
  if (!hasDraft && n !== nextSession) return <Redirect href="/" />;
  if (!session) return null;

  const Session = minimalist ? SessionMinimal : SessionImmersive;
  return (
    <Session session={session} onBack={() => goBackOr('/')} onFinish={() => setSummary(session.finish())} />
  );
}
