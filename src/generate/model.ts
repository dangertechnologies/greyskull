import { generateAsync, getAvailabilityAsync, prepareAsync } from 'expo-ai';
import type { CustomPlan, Exercise } from '../domain';
import { newPlanId } from '../planShare';
import { uniqueProgramName } from '../programPicker';
import { allowedFor, buildPrompt, buildSchema, checkGenerated } from './prompt';
import { type Answers, sessionMinutes } from './recommend';

/** One deadline for the whole request, retry included. */
export const TIMEOUT_MS = 30_000;

/** Whether the on-device model can run here. Every expo-ai failure lands in one of these, never a crash. */
export type ModelStatus =
  | { kind: 'ready' }
  /** No model on this device or OS, or the app was built without the native module. */
  | { kind: 'unsupported'; reason: string }
  /** Apple Intelligence is turned off. */
  | { kind: 'disabled' }
  /** The model is downloading or getting ready; `canDownload` when the app may start the download (Android). */
  | { kind: 'downloading'; progress: number | null; canDownload: boolean };

export async function checkModel(): Promise<ModelStatus> {
  try {
    const a = await getAvailabilityAsync();
    if (a.status === 'available') return { kind: 'ready' };
    if (a.status === 'unavailable')
      return a.reason === 'intelligence-disabled'
        ? { kind: 'disabled' }
        : { kind: 'unsupported', reason: a.reason };
    return { kind: 'downloading', progress: a.progress, canDownload: a.status === 'downloadable' };
  } catch {
    return { kind: 'unsupported', reason: 'error' };
  }
}

/** Starts the system model download where the platform allows it (Android), then reads the status again. */
export async function downloadModel(onProgress: (progress: number | null) => void): Promise<ModelStatus> {
  try {
    await prepareAsync({ allowDownload: true, onProgress });
  } catch {
    // The status read below says what state the model is in.
  }
  return checkModel();
}

export type Failure =
  /** The 30 s deadline passed. */
  | 'timeout'
  /** The model declined the request (its safety rules). */
  | 'refused'
  /** Still invalid after one retry; `errors` lists why. */
  | 'invalid'
  /** The app left the foreground and the system stopped the request (Android). */
  | 'background'
  /** The user cancelled. */
  | 'cancelled'
  /** The model stopped being available. */
  | 'unavailable'
  /** Anything else, including a request too long for the model. */
  | 'error';

export type Outcome = { ok: true; plan: CustomPlan } | { ok: false; failure: Failure; errors: string[] };

/** A Map, so an error code such as `constructor` never matches an object's inherited members. */
const FAILURES = new Map<string, Failure>([
  ['ERR_TIMEOUT', 'timeout'],
  ['ERR_MODEL_REFUSAL', 'refused'],
  ['ERR_APP_BACKGROUND', 'background'],
  ['ERR_ABORTED', 'cancelled'],
  ['ERR_MODEL_NOT_READY', 'unavailable'],
  ['ERR_MODEL_UNAVAILABLE', 'unavailable'],
]);
/** Below this much time left, a retry would only end as a timeout, so the errors are shown instead. */
const MIN_RETRY_MS = 3_000;
/** The model answered, but not in the schema's shape even after the library's own repair. */
const MALFORMED = new Set([
  'ERR_VALIDATION_RETRIES_EXHAUSTED',
  'ERR_RESPONSE_INVALID',
  'ERR_COMPLETION_INVALID',
]);
const MALFORMED_TEXT = 'The answer did not match the program format.';

const codeOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string'
    ? (e as { code: string }).code
    : '';

export interface Request {
  answers: Answers;
  /** The user's description, at most 500 characters (cleaned again here). */
  text: string;
  exercises: Record<string, Exercise>;
  /** Saved plan ids and program names, so the new plan's are unique. */
  taken: { ids: string[]; names: string[] };
  signal?: AbortSignal;
}

/**
 * Asks the on-device model for a program and checks it. A program that fails the checks (or an answer the
 * library could not fit to the schema) gets one retry with the errors in the prompt, when at least 3 s of the
 * deadline are left; a second failure, or too little time, returns them. Nothing is saved: the caller saves the plan when the user chooses to review it.
 */
export async function generatePlan(req: Request): Promise<Outcome> {
  const allowed = allowedFor(req.answers, req.exercises);
  const schema = buildSchema(allowed);
  const deadline = Date.now() + TIMEOUT_MS;
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let value: unknown;
    try {
      const result = await generateAsync(buildPrompt(req.answers, req.text, allowed, errors), {
        schema,
        signal: req.signal,
        timeoutMs: Math.max(1, Math.round(deadline - Date.now())),
      });
      value = result.value;
    } catch (e) {
      const code = codeOf(e);
      if (req.signal?.aborted) return { ok: false, failure: 'cancelled', errors: [] };
      if (MALFORMED.has(code)) {
        errors = [MALFORMED_TEXT];
        if (deadline - Date.now() < MIN_RETRY_MS) break;
        continue;
      }
      if (code === 'ERR_CONTEXT_WINDOW_EXCEEDED')
        return { ok: false, failure: 'error', errors: ['The request is too long for the on-device model.'] };
      return { ok: false, failure: FAILURES.get(code) ?? 'error', errors: [] };
    }
    const checked = checkGenerated(value, { answers: req.answers, allowed, exercises: req.exercises });
    if (checked.ok) {
      const { program } = checked;
      return {
        ok: true,
        plan: {
          id: newPlanId(req.taken.ids),
          name: uniqueProgramName(checked.name, req.taken.names),
          summary: `${program.days.length} ${program.days.length === 1 ? 'day' : 'days'} · about ${sessionMinutes(program)} min · made on this device`,
          program,
        },
      };
    }
    errors = checked.errors;
    if (deadline - Date.now() < MIN_RETRY_MS) break;
  }
  return { ok: false, failure: 'invalid', errors };
}
