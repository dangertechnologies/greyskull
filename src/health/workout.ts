import { getPlan } from '../config/plans';
import type { ActiveProgram, SessionLog } from '../domain';

export type HealthActivity = 'strength' | 'functional';

/** What gets written to Apple Health or Health Connect for one finished session. */
export interface HealthWorkout {
  /** Stable per session: writing it again replaces the earlier entry instead of adding one. */
  id: string;
  /** Higher than every earlier write of the same id; a higher version replaces a lower one. */
  version: number;
  start: Date;
  end: Date;
  title: string;
  activity: HealthActivity;
}

/** Only finished sessions that were really trained go to Health (not drafts, not skips). */
export const isSyncable = (log: SessionLog): boolean => !!log.finishedAt && !log.skipped;

export const recordId = (log: Pick<SessionLog, 'startedAt' | 'n'>): string =>
  `greyskull-${log.startedAt}-${log.n}`;

const FUNCTIONAL_CATEGORIES = ['calisthenics', 'skills'];
const MINUTE_MS = 60_000;

export function toWorkout(log: SessionLog, programs: ActiveProgram[], version: number): HealthWorkout | null {
  if (!isSyncable(log) || !log.finishedAt) return null;
  const program = programs.find((p) => p.id === log.programId);
  const category = program ? getPlan(program.template)?.category : undefined;
  const name = log.programName ?? program?.name;
  const start = new Date(log.startedAt);
  if (Number.isNaN(start.getTime())) return null;
  let end = new Date(log.finishedAt);
  // A clock that moved back must not make a workout that ends before it starts: both platforms reject that.
  if (!(end > start)) end = new Date(start.getTime() + MINUTE_MS);
  return {
    id: recordId(log),
    version,
    start,
    end,
    title: name ? `${name} · ${log.dayName}` : log.dayName,
    activity: category && FUNCTIONAL_CATEGORIES.includes(category) ? 'functional' : 'strength',
  };
}
