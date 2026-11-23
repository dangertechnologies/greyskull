import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { ActiveProgram, AppState, SessionLog } from './domain';
import { sessionFor } from './domain';
import { useStore } from './store';

/** Where weights moved over from the old version are checked; Start goes here until they are. */
export const WEIGHT_CONFIRM_ROUTE = '/setup/confirm';

const APP = 'Greyskull LP';
export const NO_PROGRAM = `You don't have a program yet. Open ${APP} to set one up.`;
export const ALL_PAUSED = `All your programs are paused. Open ${APP} to resume one.`;
export const CONFIRM_WEIGHTS = `Open ${APP} to confirm your weights.`;

/** A name as Siri says it: long names are cut, so one program cannot make a spoken line run on. */
export function spoken(name: string, max = 40): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

type StartState = Pick<AppState, 'programs' | 'draft' | 'nextSession' | 'needsWeightConfirm'>;

/** The program with the open workout, else the first one that is not paused (what the widget shows). */
export const pickProgram = (s: Pick<AppState, 'programs' | 'draft'>): ActiveProgram | undefined =>
  s.programs.find((p) => s.draft && p.id === s.draft.programId) ?? s.programs.find((p) => !p.paused);

export interface StartRoute {
  /** 'new' and 'resume' open the program's session, 'other' another program's open workout, 'confirm' the weight check, 'none' Today. */
  kind: 'new' | 'resume' | 'other' | 'confirm' | 'none';
  route: string;
  /** One sentence for what happens, as Siri says it. */
  note: string;
}

/**
 * The one decision "where does Start go" for a program (the default program when `programId` is left out):
 * Today's Start button, the program screen, Siri and Shortcuts all use it. Pure, so the spoken note and the
 * route cannot disagree.
 */
export function startRoute(s: StartState, programId?: string): StartRoute {
  const none = (note: string): StartRoute => ({ kind: 'none', route: '/', note });
  if (s.programs.length === 0) return none(NO_PROGRAM);
  const program = programId ? s.programs.find((p) => p.id === programId) : pickProgram(s);
  if (!program) {
    return programId ? none(`I couldn't find that program. Opening ${APP}.`) : none(ALL_PAUSED);
  }
  if (s.needsWeightConfirm) {
    return {
      kind: 'confirm',
      route: WEIGHT_CONFIRM_ROUTE,
      note: `Opening ${APP} so you can confirm your weights first.`,
    };
  }
  const { draft } = s;
  if (program.paused && !(draft && draft.programId === program.id)) {
    return none(`${spoken(program.name)} is paused. Opening ${APP} so you can resume it.`);
  }
  if (draft && draft.programId !== program.id) {
    const other =
      s.programs.find((p) => p.id === draft.programId)?.name ?? draft.programName ?? 'Another workout';
    return {
      kind: 'other',
      route: `/session/${draft.n}`,
      note: `${spoken(other)} is already in progress, so I'm opening that instead of ${spoken(program.name)}.`,
    };
  }
  const day = sessionFor(
    draft && draft.position !== undefined ? { ...program, position: draft.position } : program,
  ).dayName;
  return {
    kind: draft ? 'resume' : 'new',
    route: `/session/${draft?.n ?? s.nextSession}?program=${program.id}`,
    note: `${draft ? 'Resuming' : 'Starting'} ${spoken(program.name)}, ${day}.`,
  };
}

/** Sets with reps logged, and all sets, of a draft. */
export function setCounts(draft: SessionLog): { done: number; total: number } {
  const sets = Object.values(draft.results).flatMap((r) => r.sets);
  return { done: sets.filter((s) => s.reps > 0).length, total: sets.length };
}

/** Open the workout of a program. With another program's workout open, ask what to do with it first. */
export function startWorkout(program: ActiveProgram): void {
  const state = useStore.getState();
  const { draft, programs } = state;
  const go = startRoute(state, program.id);
  if (go.kind !== 'other' || !draft) {
    router.push(go.route as never);
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
