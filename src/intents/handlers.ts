import type { AppIntentInvocation } from 'expo-app-intents';
import type { AppState } from '../domain';
import { MAX_TEXT } from '../generate/prompt';
import { pickProgram } from './snapshot';

type State = Pick<AppState, 'programs' | 'draft' | 'nextSession'>;

export interface AppIntentsDeps {
  getState(): State;
  push(href: string): void;
  now(): number;
}

/** An invocation that waited longer than this (the app was not opened) is dropped rather than acted on. */
const MAX_AGE_MS = 5 * 60_000;

/**
 * Where "start my workout" sends the app: the same routes the Today screen uses. A different program's open
 * workout is opened instead (a second draft is never started); an unknown or paused program, or none at all,
 * leaves the app on Today with nothing started.
 */
export function resolveStart(s: State, programId?: string): { route: string } {
  const program = programId ? s.programs.find((p) => p.id === programId && !p.paused) : pickProgram(s);
  if (!program) return { route: '/' };
  const { draft } = s;
  if (draft && draft.programId !== program.id) return { route: `/session/${draft.n}` };
  return { route: `/session/${draft?.n ?? s.nextSession}?program=${program.id}` };
}

/**
 * Acts on one invocation. 'done' means it can be removed from the queue, 'unknown' that this build does not
 * know the name (leave it queued), and a thrown error that it failed and should stay queued.
 */
export async function handleInvocation(
  invocation: AppIntentInvocation,
  deps: AppIntentsDeps,
): Promise<'done' | 'unknown'> {
  const { name, params } = invocation;
  if (name !== 'startWorkout' && name !== 'makeProgram') return 'unknown';
  if (deps.now() - invocation.createdAt > MAX_AGE_MS) return 'done';
  if (name === 'startWorkout') {
    const id = typeof params.programId === 'string' ? params.programId : undefined;
    deps.push(resolveStart(deps.getState(), id).route);
    return 'done';
  }
  const text = typeof params.text === 'string' ? params.text.trim().slice(0, MAX_TEXT) : '';
  deps.push(text ? `/generate/describe?text=${encodeURIComponent(text)}` : '/generate/describe');
  return 'done';
}
