import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { ActiveProgram, SessionLog } from './domain';
import { useStore } from './store';

/** Sets with reps logged, and all sets, of a draft. */
export function setCounts(draft: SessionLog): { done: number; total: number } {
  const sets = Object.values(draft.results).flatMap((r) => r.sets);
  return { done: sets.filter((s) => s.reps > 0).length, total: sets.length };
}

/** Open the workout of a program. With another program's workout open, ask what to do with it first. */
export function startWorkout(program: ActiveProgram): void {
  const { draft, nextSession, programs } = useStore.getState();
  if (!draft || draft.programId === program.id) {
    router.push(`/session/${draft?.n ?? nextSession}?program=${program.id}`);
    return;
  }
  const { done } = setCounts(draft);
  Alert.alert(
    'Finish or discard the current workout?',
    `${programs.find((p) => p.id === draft.programId)?.name ?? draft.programName ?? 'The current program'} · ${draft.dayName} is still open with ${done} ${done === 1 ? 'set' : 'sets'} logged. Close it before starting ${program.name}.`,
    [
      { text: 'Resume it', onPress: () => router.push(`/session/${draft.n}`) },
      {
        text: 'Discard it',
        style: 'destructive',
        onPress: () => {
          useStore.getState().discardDraft();
          router.push(`/session/${useStore.getState().nextSession}?program=${program.id}`);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}
