import { exerciseIdsOf, PLUGINS, TEMPLATES } from './program';
import type { AppState, Exercise, ExerciseResult, LiftState, Program, SessionLog } from './types';
import { DEFAULT_INVENTORY } from './types';

interface V1Workout {
  id: number;
  completed: number | null; // epoch ms
  exercises: { definition: string; weight?: number; amrap?: number | null; completed?: number | null }[];
}
interface V1 {
  configuration: {
    initialSetupComplete: boolean;
    unit: 'METRIC' | 'IMPERIAL';
    exercises: Record<string, { include: 'REQUIRED' | 'INCLUDED' | 'EXCLUDED'; bodyweight?: boolean }>;
    weights: Record<string, { initial: number; current: number }>; // always kg
  };
  workoutPlan: V1Workout[];
}

export type MigrationPatch = Pick<
  AppState,
  | 'unit'
  | 'program'
  | 'lifts'
  | 'sessions'
  | 'nextSession'
  | 'needsWeightConfirm'
  | 'needsWeightConfirmSuspects'
>;

/** v1 weights exploded to millions; anything above 3× the start weight (or 400 kg) is not trusted. */
const looksWrong = (current: number, initial: number): boolean =>
  (initial > 0 && current > 3 * initial) || current > 400;

function isV1(value: unknown): value is V1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<V1>;
  return (
    typeof v.configuration === 'object' &&
    v.configuration !== null &&
    v.configuration.initialSetupComplete === true &&
    typeof v.configuration.weights === 'object' &&
    typeof v.configuration.exercises === 'object' &&
    Array.isArray(v.workoutPlan)
  );
}

/**
 * Turns the v1 AsyncStorage blob (`GSLP_STATE_18`) into a v2 state patch. Pure: it never touches storage,
 * so the legacy key stays intact. Returns null when `raw` is not a completed v1 setup.
 */
export function migrateV1(
  raw: string,
  catalog: Record<string, Exercise>,
): { patch: MigrationPatch; suspects: string[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isV1(parsed)) return null;
  const { configuration: cfg, workoutPlan } = parsed;

  const unit = cfg.unit === 'METRIC' ? 'kg' : 'lb';

  let program: Program = PLUGINS.chins.apply(PLUGINS.curls.apply(TEMPLATES.base));
  if (cfg.exercises.DIPS?.include === 'INCLUDED') program = PLUGINS.dips.apply(program);
  if (cfg.exercises.CRUNCHES?.include === 'INCLUDED') program = PLUGINS.abs.apply(program);
  if (cfg.exercises.BENT_OVER_ROW?.include === 'INCLUDED') {
    program = {
      ...program,
      days: program.days.map((d) => ({
        ...d,
        slots: [...d.slots, { exercise: 'BENT_OVER_ROW', scheme: '2x5+' as const }],
      })),
    };
  }

  const lifts: Record<string, LiftState> = {};
  const suspects: string[] = [];
  const initials: Record<string, number> = {};
  for (const [id, w] of Object.entries(cfg.weights)) {
    if (!(id in catalog) || typeof w.current !== 'number') continue;
    const initial = typeof w.initial === 'number' ? w.initial : 0;
    initials[id] = initial;
    if (looksWrong(w.current, initial)) {
      suspects.push(id);
      const safe = initial > 0 ? initial : DEFAULT_INVENTORY.barKg;
      lifts[id] = { weightKg: safe, startKg: safe, fails: 0 };
    } else {
      lifts[id] = { weightKg: w.current, startKg: initial || w.current, fails: 0 };
    }
  }
  // Barbell lifts the migrated program uses but v1 never stored a weight for start at the bar.
  for (const id of exerciseIdsOf(program)) {
    if (catalog[id]?.kind === 'barbell' && !lifts[id]) {
      lifts[id] = { weightKg: DEFAULT_INVENTORY.barKg, startKg: DEFAULT_INVENTORY.barKg, fails: 0 };
    }
  }

  const sessions: SessionLog[] = [];
  for (const workout of workoutPlan) {
    if (!workout.completed) continue;
    const results: Record<string, ExerciseResult> = {};
    const order: string[] = [];
    for (const e of workout.exercises) {
      if (!e.completed || !(e.definition in catalog)) continue;
      const weightKg = e.weight ?? 0;
      if (looksWrong(weightKg, initials[e.definition] ?? 0)) continue;
      results[e.definition] = { weightKg, sets: [{ target: null, reps: e.amrap ?? 0 }] };
      order.push(e.definition);
    }
    const when = new Date(workout.completed).toISOString();
    sessions.push({ n: workout.id, dayName: '', startedAt: when, finishedAt: when, results, order });
  }
  sessions.sort((a, b) => a.n - b.n);

  return {
    patch: {
      unit,
      program,
      lifts,
      sessions,
      nextSession: sessions.length,
      needsWeightConfirm: true,
      needsWeightConfirmSuspects: suspects,
    },
    suspects,
  };
}
