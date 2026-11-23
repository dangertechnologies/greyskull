import type { AppIntentEntity } from 'expo-app-intents';
import type { ActiveProgram, AppState } from '../domain';
import { sessionFor } from '../domain';
import { nextWorkoutProps } from '../widgets/summary';

type State = Pick<AppState, 'programs' | 'exercises' | 'inventory' | 'unit' | 'draft'>;

/** Catalog kinds; the Swift side (app-intents/WorkoutSnapshot.swift) reads the same strings. */
export const PROGRAM_KIND = 'program';
export const NEXT_KIND = 'nextWorkout';
export const NEXT_ID = 'next';

const APP = 'Greyskull LP';
const NO_PROGRAM_START = `Opening ${APP} so you can set up a program.`;
const NO_PROGRAM = `You don't have a program yet. Open ${APP} to set one up.`;

/** The program the widget shows: the one with the open workout, else the first that is not paused. */
export const pickProgram = (s: Pick<AppState, 'programs' | 'draft'>): ActiveProgram | undefined =>
  s.programs.find((p) => s.draft && p.id === s.draft.programId) ?? s.programs.find((p) => !p.paused);

/** The spoken answer to "what's my next workout": the widget's text with the program name in front. */
export function nextWorkoutText(s: State): string {
  const program = pickProgram(s);
  const next = nextWorkoutProps(s);
  if (!program || !next.ready) return NO_PROGRAM;
  const lines = next.lines.length ? ` ${next.lines.join(', ')}.` : '';
  return `${next.inProgress ? 'In progress. ' : ''}${program.name}: ${next.title}, ${next.subtitle}.${lines}`;
}

/** What Siri says when `program` is started now. Mirrors where `resolveStart` sends the app. */
export function startNote(s: Pick<AppState, 'programs' | 'draft'>, program: ActiveProgram): string {
  const { draft } = s;
  if (draft && draft.programId !== program.id) {
    const other =
      s.programs.find((p) => p.id === draft.programId)?.name ?? draft.programName ?? 'Another workout';
    return `${other} is already in progress, so I'm opening that instead of ${program.name}.`;
  }
  const day = sessionFor(
    draft && draft.position !== undefined ? { ...program, position: draft.position } : program,
  ).dayName;
  return `${draft ? 'Resuming' : 'Starting'} ${program.name}, ${day}.`;
}

/**
 * What the intents may read while the app is not running: program names with their day, and two sentences.
 * Plain text only; nothing about the person beyond program names and weights.
 */
export function buildCatalogs(s: State): { programs: AppIntentEntity[]; next: AppIntentEntity[] } {
  const programs = s.programs
    .filter((p) => !p.paused)
    .map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: sessionFor(p).dayName,
      metadata: { start: startNote(s, p) },
    }));
  const program = pickProgram(s);
  return {
    programs,
    next: [
      {
        id: NEXT_ID,
        title: 'Next workout',
        hideInSpotlight: true,
        metadata: {
          text: nextWorkoutText(s),
          start: program ? startNote(s, program) : NO_PROGRAM_START,
        },
      },
    ],
  };
}
