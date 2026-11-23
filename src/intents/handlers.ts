import type { AppIntentInvocation } from 'expo-app-intents';
import type { AppState } from '../domain';
import { MAX_TEXT } from '../generate/prompt';
import { startRoute } from '../programStart';

export interface AppIntentsDeps {
  getState(): Pick<AppState, 'programs' | 'draft' | 'nextSession' | 'needsWeightConfirm'>;
  /** Opens a route, reusing a screen that is already open for it. */
  navigate(href: string): void;
  /** The path of the screen showing now, e.g. "/session/12". */
  current(): string | undefined;
  now(): number;
}

/**
 * An invocation that waited longer than this is dropped rather than acted on: it must never open a screen
 * unprompted later, for example after the recovery screen was dismissed.
 */
const MAX_AGE_MS = 60_000;

/** Control and invisible formatting characters (including right-to-left overrides) never reach the text box. */
const UNWANTED = /[\p{Cc}\p{Cf}]+/gu;

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
    const { route } = startRoute(deps.getState(), id);
    // Already looking at it (or a second request for it just arrived): do not stack another copy.
    if (route.split('?')[0] !== deps.current()) deps.navigate(route);
    return 'done';
  }
  const text =
    typeof params.text === 'string'
      ? params.text.replace(UNWANTED, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT).trim()
      : '';
  deps.navigate(text ? `/generate/describe?text=${encodeURIComponent(text)}` : '/generate/describe');
  return 'done';
}
